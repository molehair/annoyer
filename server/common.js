var crypto = require('crypto');
var mongo = require('mongodb');
var MongoClient = mongo.MongoClient
const session = require('express-session');
const MongoDBSession = require('connect-mongodb-session');
var schedule = require('node-schedule');
const logger = require('./logger');
const fetch = require('node-fetch');
const semaphore = require('semaphore');
const env = process.env;

// notification
const totalTime = 8*60;     // total practice time in min
const stackSize = 16;       // # of terms a day
const nRepsTerm = 3;        // # of repetitions per term
const maxNumTermsNoti = 3;  // the maximum # of terms per a notification

// just don't touch
var secret;

// counting map semaphores for users
var cntMapSems = {};

// scheduler
var schedules = {};
var workers = {};

var exports = {
  db: null,
  termTypes: {default: 1, audioClip: 2},
  notiTypes: {practice: 1, test: 2, announcement: 3},
  importExportFields: ['type', 'term', 'def', 'ex', 'mnemonic', 'level'],

  init: function(app) {
    // trimming and stripping(/) cliant address
    let clientAddress = env.CLIENT_ADDRESS.trim();
    if(clientAddress.endsWith('/'))
      clientAddress = clientAddress.substring(0, clientAddress.length-1);

    return MongoClient.connect(env.MONGODB_ADDRESS, { useNewUrlParser: true })
    .then(client => {
      const db = client.db(env.DB_NAME);
      const users = db.collection('users');
      const terms = db.collection('terms');
      const others = db.collection('others');
      
      let promises = [];
      exports.db = db;
    
      // secret
      promises.push(others.findOne({secret : /.*/})
      .then(doc => {
        if(doc) {
          // found secret
          secret = doc.secret;
          logger.log('info', 'Found secret.');
        } else {
          // no secret found
          // generate a new secret
          secret = crypto.randomBytes(48).toString('hex');
          return others.insertOne({secret})
          .then(() => logger.log('info', 'Generated new secret.'));
        }
      }).then(() => {
        //-- secured secret --//
        // session
        const MongoDBStore = MongoDBSession(session);
        app.use(session({
          secret,
          name: 'sessionID',
          store: new MongoDBStore({
            uri: env.MONGODB_ADDRESS+'/'+env.DB_NAME,
            databaseName: env.DB_NAME,
            collection: 'sessions',
          }),
          resave: false,
          saveUninitialized: false,
          cookie: {maxAge: 100*365*24*60*60*1000},    // 100 years
        }));
    
        // CORS
        app.use(function(req, res, next) {
          res.header("Access-Control-Allow-Origin", clientAddress);
          res.header("Access-Control-Allow-Credentials", "true");
          res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
          next();
        });
    
        // routes before login
        app.use('/getCurrentUser', require('./routes/getCurrentUser'));
        app.use('/login', require('./routes/login'));
        app.use('/register', require('./routes/register'));
        
        // filter out guests
        app.use(function(req, res, next) {
          if (typeof req.session.user === 'undefined') {
            return res.send({result: false});
            // return res.status(404).send('Not found');  // client doesn't send cookie with this code(why??)
          }
          return next();
        });
        
        // route after login
        app.use('/getTerm', require('./routes/getTerm'));
        app.use('/getTermList', require('./routes/getTermList'));
        app.use('/setTerm', require('./routes/setTerm'));
        app.use('/getStack', require('./routes/getStack'));
        app.use('/applyTestResult', require('./routes/applyTestResult'));
        app.use('/setToken', require('./routes/setToken'));
        app.use('/delTerms', require('./routes/delTerms'));
        app.use('/getSettings', require('./routes/getSettings'));
        app.use('/setSettings', require('./routes/setSettings'));
        app.use('/logout', require('./routes/logout'));
        app.use('/backup', require('./routes/backup'));
        app.use('/restore', require('./routes/restore'));
        app.use('/closeAccount', require('./routes/closeAccount'));
        
        // 404
        app.use(function(req, res, next) {
          return res.status(404).send('');
        });
      }));
    
      // user-specific variables
      promises.push(users.find().toArray()
      .then(docs => {
        for(var doc of docs) {
          // scheduler
          if(doc.doPractice) {
            exports.setScheduler(
              doc._id,
              doc.doPractice,
              doc.alarmClock,
              doc.enabledDays
            );
          }

          // semaphore for applyCountingMapChange()
          cntMapSems[doc._id] = semaphore(1);
        }
        logger.log('info', 'Schedulers are set.');
      }));
    
      // indices
      promises.push(terms.createIndex({term: 1})
      .then(() => logger.log('info', 'Created term index(ascending)')));
      promises.push(terms.createIndex({term: -1})
      .then(() => logger.log('info', 'Created term index(descending)')));
    
      return Promise.all(promises).catch(err => {
        logger.log('error', 'Unabled to run the server');
        throw err;
      });
    }).then(() => {
      logger.log('info', '* Annoyer server is ready.');
    });
  },

  setToken: function (uid, token) {
    return retreiveNotificationKey(uid)
    .then(notificationKey => {
      if(!notificationKey) {
        //-- need to elicit a new one --//
        // create one and add token
        let body = {
          operation: 'create',
          notification_key_name: uid,
          registration_ids: [token],
        };
        return fetch('https://fcm.googleapis.com/fcm/notification', { 
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'key=' + env.FCM_SERVER_KEY,
            'project_id': env.FCM_SENDER_ID,
          },
          body: JSON.stringify(body),
        }).then(res => {
          return (res.ok) ? res.json() : {};
        }).then(json => {
          if(json.error === 'notification_key already exists') {
            return retreiveNotificationKey();
          } else if(json.notification_key) {
            return json.notification_key;
          } else
            throw json;
        });
      } else {
        // add token to the group
        let body = {
          operation: 'add',
          notification_key_name: uid,
          notification_key: notificationKey,
          registration_ids: [token],
        };
        return fetch('https://fcm.googleapis.com/fcm/notification', { 
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'key=' + env.FCM_SERVER_KEY,
            'project_id': env.FCM_SENDER_ID,
          },
          body: JSON.stringify(body),
        }).then(res => {
          if(res.ok)
            return res.json();
          else {
            logger.log('error', res);
            return false;
          }
        });
      }
    });
  },

  hashPassword: function (password) {
    return crypto.createHmac('sha1', secret).update(password).digest('hex');
  },

  setTerms: function(data, uid, isModifying) {
    let promises = Array(data.length);
    const terms = exports.db.collection('terms');

    for(var i=0; i<data.length; i++) {
      promises[i] = new Promise((resolve, reject) => {
        const t = data[i];
        const _id = t._id || '';
        const term = t.term || '';
        const type = t.type;
        const level = t.level || 1;

        // prepare new document
        let newDoc;
        if(type === exports.termTypes.default) {
          if(isModifying) {
            newDoc = {      // allow to modify only the following fields
              ex: t.ex || '',
              mnemonic: t.mnemonic || '',
            };
          } else {
            newDoc = {
              uid,
              type,
              term,
              def: t.def || '',
              ex: t.ex || '',
              mnemonic: t.mnemonic || '',
              level,
              defScore: 0,
              exScore: 0,
            };
          }
        } else if(type === exports.termTypes.audioClip) {
          throw new Error('implememtsadfafsagae!');
        }

        // set term
        if(isModifying) {
          return terms.updateOne({
            _id: new mongo.ObjectID(_id),
            uid
          }, {$set:newDoc})
          .then(() => resolve());
        } else {
          let r = {type, level};
          return terms.insertOne(newDoc)
          .then(result => {
            r.change = result.insertedCount;
            return r;
          }).catch(err => {
            logger.log('error', err);
            r.change = 0;
            return r;
          }).then(r => resolve(r));
        }
      });
    }

    // maintain couting map
    return Promise.all(promises).then(results => {
      // sum up deleted counts
      let counts = {}, r;
      counts[exports.termTypes.default] = {};
      counts[exports.termTypes.audioClip] = {};
      for(r of results) {
        if(counts[r.type][r.level]) {
          counts[r.type][r.level] += r.change;
        } else {
          counts[r.type][r.level] = r.change;
        }
      }

      // apply
      this.applyCountingMapChange(counts, uid);
    });
  },

  delTerms: function(termIDs, uid) {
    let promises = Array(termIDs.length);
    const terms = exports.db.collection('terms');

    for(var i=0; i<termIDs.length; i++) {
      promises[i] = terms.findOneAndDelete({
        _id: new mongo.ObjectID(termIDs[i]),
        uid,
      }).then(result => {
        if(result.value) {
          return {
            type: result.value.type,
            level: result.value.level,
            change: -1,
          };
        }
      }).catch(err => {
        logger.log('error', err);
      });
    }

    // maintain couting map
    return Promise.all(promises).then(results => {
      // sum up deleted counts
      let counts = {}, r;
      counts[exports.termTypes.default] = {};
      counts[exports.termTypes.audioClip] = {};
      for(r of results) {
        if(r) {
          if(counts[r.type][r.level]) {
            counts[r.type][r.level] += r.change;
          } else {
            counts[r.type][r.level] = r.change;
          }
        }
      }

      // apply
      this.applyCountingMapChange(counts, uid);
    });
  },

  applyTestResult: function(testResults, uid) {
    let promises = [];
    const terms = exports.db.collection('terms');
  
    for(const termID in testResults) {
      const testResult = testResults[termID];
      promises.push(terms.findOne({_id: new mongo.ObjectID(termID), uid})
        .then(doc => {
          if(doc) {
            let oldLevel = doc.level, newLevel;
            if(doc.type === exports.termTypes.default) {
              const defScoreChange = testResult.defScoreChange || 0;
              const exScoreChange = testResult.exScoreChange || 0;
  
              doc.defScore += defScoreChange;
              doc.exScore += exScoreChange;

              if(doc.defScore >= 1 && doc.exScore >= 1) {
                // level up
                doc.defScore = doc.exScore = 0;
                doc.level += 1;
                newLevel = doc.level;
              } else if(doc.defScore < 0 || doc.exScore < 0) {
                // level down
                doc.defScore = doc.exScore = 0;
                if(doc.level > 1) {
                  doc.level -= 1;
                  newLevel = doc.level;
                } else {
                  newLevel = oldLevel;
                }
              } else {
                // no level change
                newLevel = oldLevel;
              }
  
              return terms.replaceOne({_id: new mongo.ObjectID(termID)}, {$set: doc})
              .then(() => {return {type: doc.type, oldLevel, newLevel}});
            } else if(prevType === exports.termTypes.audioClip) {
              throw new Error('oisadmfoa0uiyugaasahsmkmals;');
            }
          }
        })
      );
    }
    
    // maintain couting map
    return Promise.all(promises).then(results => {
      // sum up the level changes
      let counts = {}, r, count;
      counts[exports.termTypes.default] = {};
      counts[exports.termTypes.audioClip] = {};
      for(r of results) {
        count = counts[r.type];

        // increment newLevel
        if(count[r.newLevel]) {
          count[r.newLevel]++;
        } else {
          count[r.newLevel] = 1;
        }

        // decrement oldLevel
        if(count[r.oldLevel]) {
          count[r.oldLevel]--;
        } else {
          count[r.oldLevel] = -1;
        }
      }

      // trim for efficiency
      for(count in counts) {
        exports.trimCountingMap(count);
      }

      // apply
      this.applyCountingMapChange(counts, uid);
    });
  },

  applyCountingMapChange: function(counts, uid) {
    const users = exports.db.collection('users');
    let typeName;

    cntMapSems[uid].take(() => {
      return users.findOne({_id: uid}).then(doc => {
        for(typeName in exports.termTypes) {
          const type = exports.termTypes[typeName];
          const countingMapChange = counts[type];
          if(Object.keys(countingMapChange).length > 0) {
            exports.mergeCountingMaps(
              doc.countingMapDefault,
              countingMapChange
            );
            exports.trimCountingMap(doc.countingMapDefault);

            let set;
            if(type === exports.termTypes.default) {
              set = {countingMapDefault: doc.countingMapDefault};
            } else {
              logger.log('error', 'iasmdpfjoqadagdsl;sd');
            } 
            return users.updateOne({_id: uid}, {$set: set})
            .then(() => cntMapSems[uid].leave());
          }
        }
      })
    }, 1);
  },

  setScheduler: function(uid, doPractice, alarmClock, enabledDays) {
    // clear previous scheduler
    logger.log('info', {schedules});
    if(uid in schedules) {
      schedules[uid].cancel();
      clearInterval(workers[uid]);
    }

    // check it is to run scheduler
    if(!doPractice || enabledDays.every(x => {return !x})) {
      delete schedules[uid];
      delete workers[uid]
      return;
    }

    // create rule
    const offset = new Date().getTimezoneOffset();    // offset to UTC
    alarmClock = (alarmClock - offset);               // local time, before range adjust
    alarmClock = alarmClock % (24*60);          // intermediate
    alarmClock = (alarmClock >= 0) ? alarmClock : alarmClock + 26*60;   // adjusted. Range: [0, 24*60)
    const hour = Math.floor(alarmClock / 60);
    const minute = alarmClock % 60;
    let rule = minute + ' ' + hour + ' * * ';
    if(enabledDays.every(x => {return x}))
      rule += '*';
    else {
      for(var i=0;i<7;i++) {
        if(enabledDays[i])
          rule += i+',';
      }
      rule = rule.substring(0, rule.length-1);
    }
    
    // set schedule
    schedules[uid] = schedule.scheduleJob(rule, () => {
      let notiInterval = 0;   // notification interval, min.
      let schedulerVars = {
        uid,
        curNotifiedCount: 0,
        nTermsNoti: 0,     // # of terms per notification
        nTotalNoti: 0,     // # of total notifications per day
        stack: [],
        stackId: '',
      };

      // create a stack
      return createStack(uid).then((st) => {
        schedulerVars.stack = st;
        const stacks = exports.db.collection('stacks');
        return stacks.deleteOne({uid})
        .then(() => {
          return stacks.insertOne({uid, stack: st})
        }).then((result) => {
          schedulerVars.stackId = result.insertedId.toHexString();
        });
      }).then(() => {
        if(!schedulerVars.stack.length) return;

        // calculate variables for worker
        if(schedulerVars.stack.length < maxNumTermsNoti) {
          schedulerVars.nTermsNoti = schedulerVars.stack.length;
          schedulerVars.nTotalNoti = nRepsTerm;
        } else {
          schedulerVars.nTermsNoti = maxNumTermsNoti;
          schedulerVars.nTotalNoti = Math.ceil(schedulerVars.stack.length * nRepsTerm / maxNumTermsNoti);
        }
        notiInterval = totalTime / schedulerVars.nTotalNoti;
        
        // run initial execution
        workerFunction(schedulerVars);

        // set worker
        delete workers[uid];
        workers[uid] = setInterval(() => {
          workerFunction(schedulerVars);
        // }, 1*1000);     // debug
        }, notiInterval*60*1000);
      });
    });
  },

  sendMsg: function(uid, msg) {
    return retreiveNotificationKey(uid)
    .then(notificationKey => {
      if(notificationKey) {
        return sendToGroup(notificationKey, msg);
      } else {
        return false;
      }
    });
  },

  // No return. 'origin' argument will be changed.
  mergeCountingMaps: function(origin, change) {
    for(var lvl in change) {
      if(lvl in origin)
        origin[lvl] += change[lvl];
      else
        origin[lvl] = change[lvl];
    }
  },
  
  // delete elements whose value is <= 0
  trimCountingMap: function(countingMap) {
    for(var lvl in countingMap) {
      if(countingMap[lvl] <= 0)
        delete countingMap[lvl];
    }
  },

  logout: function(session) {
    const uid = session.uid;
    let promises = [];

    // remove token from the group
    promises.push(retreiveNotificationKey(uid)
    .then(notificationKey => {
      let body = {
        operation: 'remove',
        notification_key_name: uid,
        notification_key: notificationKey,
        registration_ids: [session.token],
      };
      return fetch('https://fcm.googleapis.com/fcm/notification', { 
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'key=' + env.FCM_SERVER_KEY,
          'project_id': env.FCM_SENDER_ID,
        },
        body: JSON.stringify(body),
      }).then(res => {
        if(res.ok)
          return res.json();
        else {
          logger.log('error', res);
          return false;
        }
      });
    }));
  
    // destroy session
    promises.push(new Promise((resolve, reject) => {
      session.destroy(function(err) {
        if(err) reject(err);
        else    resolve();
      });
    }));
    
    return Promise.all(promises);
  },
};

// Return the stack
// currently default terms only
function createStack(uid) {
  const terms = exports.db.collection('terms');
  const users = exports.db.collection('users');
  return users.findOne({_id: uid})
  .then(doc => {
    const countingMapDefault = doc.countingMapDefault;

    let curTotalNumTerms = 0;
    for(const lvl in countingMapDefault)
      curTotalNumTerms += countingMapDefault[lvl];
    if(curTotalNumTerms > stackSize) {
      //-- choose random terms --//

      // build splitter
      let splitter=[[0, 0]], splitterMax=0;
      for(const lvl in countingMapDefault) {
        const l = parseInt(lvl);
        splitter.push([l, splitterMax+countingMapDefault[l]/l]);
        splitterMax += countingMapDefault[l];
      }

      // get # of terms for each level
      let numTerms = {};
      for(var i=0;i<stackSize;) {
        var x = Math.random()*splitterMax;

        // find bucket
        for(var p=1, q=splitter.length-1; p<=q;) {
          var m = Math.floor((p+q)/2);
          if(splitter[m-1][1] < x && x <= splitter[m][1]) {
            const l = splitter[m][0];
            if(!(l in numTerms) || numTerms[l] < countingMapDefault[l]) {
              numTerms[l] = numTerms[l] + 1 || 1;
              i++;
            }
            break;
          } else {
            if(x <= splitter[m-1][1])
              q = m - 1;
            else
              p = m + 1;
          }
        }
      }

      // build stack
      let promises = [];
      for(const lvl in numTerms) {
        promises.push(terms.find({uid, level:parseInt(lvl)})
        .project({_id:1}).toArray()
        .then((result) => {
          let sample=[];
          if(numTerms[lvl] < result.length) {
            let sampleSet = {};
            // pick up numTerms[lvl] samples
            for(var i=0;i<numTerms[lvl];) {
              const x = Math.floor(Math.random()*result.length);
              if(!(x in sampleSet)) {
                sampleSet[x] = 1;
                i++; 
              }
            }
            for(var idx in sampleSet)
              sample.push(result[idx]);
          } else {
            // pick up entire result
            sample = result;
          }
          return sample;
        }));
      }
      return Promise.all(promises).then((samples) => {
        var retval = [];
        for(var r1 of samples) {
          for(var r2 of r1)
            retval.push(r2._id.toHexString());
        }
        return retval;
      });
    } else {
      // choose entire terms
      return terms.find({uid}).project({_id:1}).toArray()
      .then((docs) => {
        let stack = [];
        for(var doc of docs)
          stack.push(doc._id.toHexString());
        return stack;
      });
    }
  });
}

// compose & send practice, test notification
function workerFunction(schedulerVars) {
  const {
    uid,
    curNotifiedCount,
    nTermsNoti,
    nTotalNoti,
    stack,
    stackId
  } = schedulerVars;
  if(curNotifiedCount >= nTotalNoti) {
    //-- send test msg --//
    // build msg
    msg = {
      notiType: exports.notiTypes.test,
      stackId: stackId,
    };

    // send
    exports.sendMsg(uid, msg);

    clearInterval(workers[uid]);
  } else {
    //-- send practice msg --//
    // build msg
    const curIndices = [];
    let i = (curNotifiedCount * nTermsNoti) % stack.length;
    for(var j=0;j<nTermsNoti;j++)
      curIndices.push((i+j) % stack.length);
    let msg = {
      notiType: exports.notiTypes.practice,
      stackId: stackId,
      curIndices: curIndices,
    };

    // send
    exports.sendMsg(uid, msg)
    .then(() => {
      // increment notification counter
      schedulerVars.curNotifiedCount++;
    });
  }
}

function sendToGroup(notificationKey, data) {
  const body = {to: notificationKey, data};
  return fetch('https://fcm.googleapis.com/fcm/send', { 
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'key=' + env.FCM_SERVER_KEY,
    },
    body: JSON.stringify(body),
  }).then(res => {
    if(res.ok)
      return res.json();
    else {
      logger.log('error', res);
      return {success: 0, failure: 0};
    }
  });
}

function retreiveNotificationKey(uid) {
  return fetch('https://fcm.googleapis.com/fcm/notification?notification_key_name='+uid, {
    method: 'get',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'key=' + env.FCM_SERVER_KEY,
      'project_id': env.FCM_SENDER_ID,
    },
  }).then(res => {
    return (res.ok) ? res.json() : {notification_key: null};
  }).then(json => {return json.notification_key});
}

module.exports = exports;