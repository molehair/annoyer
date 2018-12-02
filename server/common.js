const crypto = require('crypto');
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient
const session = require('express-session');
const MongoDBSession = require('connect-mongodb-session');
const schedule = require('node-schedule');
const logger = require('./logger');
const fetch = require('node-fetch');
const semaphore = require('semaphore');
const env = process.env;

const ABORT_PROMISE_CHAIN = 'apc';

// notification
const totalTime = 8*60;     // total practice time in min
const stackSize = 16;       // # of terms a day
const nRepsTerm = 3;        // # of repetitions per term
const nTermsNoti = 3;       // # of terms per a notification
const nTotalNoti = Math.ceil(stackSize * nRepsTerm / nTermsNoti);   // # of notification a day
const notiInterval = totalTime / nTotalNoti;    // the interval between subsequent notifications in min

// just don't touch
var secret;

// semaphores for users
// You need to init these in register.js and exports.init()
var userSems = {};            // general purpose for each user

// scheduler
var schedules = {};     // daily scheduler
var workers = {};       // workerFunction() launcher within a day

var exports = {
  db: null,
  termTypes: {default: 1, audioClip: 2},
  notiTypes: {practice: 1, test: 2, announcement: 3},
  importExportFields: ['type', 'term', 'def', 'ex', 'mnemonic', 'level'],

  init: function(app) {
    // export variables
    exports.stackSize = stackSize;
    exports.userSems = userSems;

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
      const stacks = db.collection('stacks');
      
      let promises = [];
      exports.db = db;
    
      // secret
      promises.push(others.findOne({secret : /.*/})
      .then(doc => {
        if(doc) {
          // found secret
          secret = doc.secret;
          logger.info('Found secret.');
        } else {
          // no secret found
          // generate a new secret
          secret = crypto.randomBytes(48).toString('hex');
          return others.insertOne({secret})
          .then(() => logger.info('Generated new secret.'));
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
        for(let userDoc of docs) {
          const uid = userDoc._id;

          // semaphores
          userSems[uid] = semaphore(1);

          // scheduler
          if(userDoc.doPractice) {
            exports.setScheduler(
              uid,
              userDoc.doPractice,
              userDoc.alarmClock,
              userDoc.enabledDays,
            );

            // restore broken scheduler
            stacks.findOne({uid})
            .then(stackDoc => {
              const date = new Date();
              const curTime = date.getUTCHours()*60 + date.getUTCMinutes();
              const elapsedTime = (24*60 + curTime - userDoc.alarmClock) % (24*60);
              if(stackDoc && elapsedTime <= totalTime) {   // unfulfilled practice or test?
                let offset = (totalTime + userDoc.alarmClock - curTime) % notiInterval; // totalTime => to make offset positive

                // prevent unintended successive practice/test notifications
                // ex) Alarm is set on 10:00. After sending 2nd noti on 10:30, the server is reset.
                //     When it booted at 10:30, we should not send the next one at 10:30 again.
                if(offset === 0 &&
                  Math.floor(elapsedTime/notiInterval) + 1 <= stackDoc.curNotifiedCount) {
                  offset = notiInterval;
                }

                setTimeout(() => {
                  workerFunction(uid)    // initial execution
                  .then(() => {
                    if(stackDoc.curNotifiedCount < nTotalNoti) {  // Was it not a test?
                      // set worker for the rest
                      setWorker(uid, setInterval(() => {
                        workerFunction(uid);
                      }, notiInterval*60*1000));
                    }
                  });
                }, offset*60*1000);
              }
            });
          }
        }
        logger.info('Schedulers are set.');
      }));
    
      // indices
      promises.push(terms.createIndex({term: 1})
      .then(() => logger.info('Created term index(ascending)')));
      promises.push(terms.createIndex({term: -1})
      .then(() => logger.info('Created term index(descending)')));
    
      return Promise.all(promises).then(() => {
        logger.info('* Annoyer server is ready.');
      }).catch(err => {
        logger.error('Unabled to run the server');
        throw err;
      });
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
            logger.error(res);
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
            logger.error(err.stack);
            r.change = 0;
            return r;
          }).then(r => resolve(r));
        }
      });
    }

    return Promise.all(promises).then(results => {
      if(!isModifying) {
        //-- maintain couting map --//
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
      }
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
        logger.error(err.stack);
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
    const stacks = exports.db.collection('stacks');
  
    return stacks.findOne({uid}).then(s => {
      if(s) {
        // build object of termIDs in the stack
        const stackDic = {};
        for(const termID of s.stack) {
          stackDic[termID]=true;
        }

        for(let termID in testResults) {
          // filter out termID not in the stack
          if(!(termID in stackDic)) continue;
          
          termID = new mongo.ObjectID(termID);

          const testResult = testResults[termID];
          promises.push(terms.findOne({_id: termID, uid})
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
        
        return Promise.all(promises).then(results => {
          //-- maintain couting map --//
          // sum up the level changes
          let counts = {}, r, count;
          counts[exports.termTypes.default] = {};
          counts[exports.termTypes.audioClip] = {};
          for(r of results) {
            if(r) {
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
          }
    
          // trim for efficiency
          for(count in counts) {
            exports.trimCountingMap(count);
          }
    
          // apply
          return this.applyCountingMapChange(counts, uid)
          .then(() => {
            //-- cleaning up --//
            clearWorker(uid);
            return stacks.deleteOne({uid});
          });
        });
      } else {
        throw new Error('Invalid test');
      }
    });
  },

  applyCountingMapChange: function(counts, uid) {
    const users = exports.db.collection('users');
    let typeName;

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
            logger.error('iasmdpfjoqadagdsl;sd');
          } 
          return users.updateOne({_id: uid}, {$set: set});
        }
      }
    });
  },

  setScheduler: function(uid, doPractice, alarmClock, enabledDays) {
    const stacks = exports.db.collection('stacks');

    // clear previous schedule
    if(uid in schedules) {
      schedules[uid].cancel();
    }
    clearWorker(uid);

    // check it is to run scheduler
    if(!doPractice || enabledDays.every(x => {return !x})) {
      delete schedules[uid];
      clearWorker(uid);
      return;
    }

    // create rule
    const offset = new Date().getTimezoneOffset();    // offset to UTC
    alarmClock = (24*60 + alarmClock - offset) % (24*60);     // local time. Range: [0, 24*60)
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
      // create a stack
      return createStack(uid).then(stack => {
        if(stack.length < stackSize) {
          // demand at least <stackSize> terms
          msg = {
            notiType: exports.notiTypes.announcement,
            msg: 'Set at least ' + stackSize + ' terms to kick off!',
          };
          exports.sendMsg(uid, msg);
          throw new Error(ABORT_PROMISE_CHAIN);
        } else {
          return stacks.insertOne({
            uid,
            curNotifiedCount: 0,
            stack,
          });
        }
      }).then(() => {
        // run initial execution
        workerFunction(uid);

        // set worker
        clearWorker(uid);
        setWorker(uid, setInterval(() => {
          workerFunction(uid);
        }, notiInterval*60*1000));
      }).catch(err => {
        if(err.message !== ABORT_PROMISE_CHAIN) {
          logger.error(err.stack);
        }
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
          logger.error(res);
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
        .then(result => {
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
      return Promise.all(promises).then(samples => {
        var retval = [];
        for(var r1 of samples) {
          for(var r2 of r1)
            retval.push(r2._id);
        }
        return retval;
      });
    } else {
      return [];    // empty stack
    }
  });
}

// compose & send practice, test notification
function workerFunction(uid) {
  const stacks = exports.db.collection('stacks');
  return stacks.findOne({uid}).then(doc => {
    // check no stack
    if(!doc) {
      clearWorker(uid);
      return;
    }
    
    const stackId = doc._id;
    const {curNotifiedCount} = doc;

    // build msg
    let msg;
    if(curNotifiedCount >= nTotalNoti) {
      //-- send test msg --//
      msg = {
        notiType: exports.notiTypes.test,
        stackId,
      };
    } else {
      //-- send practice msg --//
      const curIndices = [];
      let i = (curNotifiedCount * nTermsNoti) % stackSize;
      for(var j=0;j<nTermsNoti;j++) {
        curIndices.push((i+j) % stackSize);
      }
      msg = {
        notiType: exports.notiTypes.practice,
        stackId,
        curIndices,
      };
    }

    // send
    return exports.sendMsg(uid, msg)
    .then(() => {
      // increment notification counter
      return stacks.updateOne({uid}, {$set: {
        curNotifiedCount: curNotifiedCount+1,
      }})
    });
  });
}

function setWorker(uid, obj) { workers[uid] = obj }
function clearWorker(uid) {
  clearTimeout(workers[uid]);
  clearInterval(workers[uid]);
  delete workers[uid];
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
      logger.error(res);
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