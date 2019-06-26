const crypto = require('crypto');
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient
const session = require('express-session');
const MongoDBSession = require('connect-mongodb-session');
const schedule = require('node-schedule');
const logger = require('./logger');
const fetch = require('node-fetch');
const semaphore = require('semaphore');
const cs = require('../lib/checksum');
const conf = require('../lib/conf');
const Json2csvParser = require('json2csv').Parser;

const env = process.env;
const importExportProject = conf.importExportFields.reduce(
  (acc, cur) => {acc[cur] = 1; return acc}, {_id: 0}
);

// notification
const totalTime = 8*60;     // total practice time: 8 hours
const stackSize = 16;       // # of terms a day
const nRepsTerm = 3;        // # of repetitions per term
const nTermsNoti = 3;       // # of terms per a notification
const nTotalNoti = Math.ceil(stackSize * nRepsTerm / nTermsNoti);   // # of notification a day
const notiInterval = totalTime / nTotalNoti;    // the interval between subsequent notifications in min

// just don't touch
var secret;

// semaphores for users
// You need to init these in exports.register() and exports.init()
var userSems = {};            // general purpose for each user

// scheduler
var schedules = {};     // daily scheduler
var workers = {};       // workerFunction() launcher within a day

var db, cli, exports = {};

exports.init = async app => {
  // export variables
  exports.stackSize = stackSize;
  exports.userSems = userSems;

  // trimming and stripping(/) cliant address
  let clientAddress = env.CLIENT_ADDRESS.trim();
  if(clientAddress.endsWith('/')) {
    clientAddress = clientAddress.substring(0, clientAddress.length-1);
  }

  cli = await MongoClient.connect(env.MONGODB_ADDRESS, { useNewUrlParser: true });
  db = cli.db(env.DB_NAME);
  const users = db.collection('users');
  const terms = db.collection('terms');
  const others = db.collection('others');
  const stacks = db.collection('stacks');
  
  let proms = [];

  // secret related jobs
  proms.push(others.findOne({secret : /.*/})
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
    app.use('/login', require('./routes/login'));
    app.use('/register', require('./routes/register'));
    
    // filter out guests
    app.use(function(req, res, next) {
      if (typeof req.session.uid === 'undefined') {
        return res.send({result: false, msg: 'unauthorized'});    // 'unauthorized' is used in core.js of client
        // return res.status(404).send('Not found');  // client doesn't send cookie with this code(why??)
      }
      return next();
    });
    
    // route after login
    app.use('/getAuxInfos', require('./routes/getAuxInfos'));
    app.use('/getTermList', require('./routes/getTermList'));
    app.use('/getTerm', require('./routes/getTerm'));
    app.use('/setTerms', require('./routes/setTerms'));
    app.use('/getStack', require('./routes/getStack'));
    app.use('/applyTestResult', require('./routes/applyTestResult'));
    app.use('/setToken', require('./routes/setToken'));
    app.use('/delToken', require('./routes/delToken'));
    app.use('/delTerms', require('./routes/delTerms'));
    app.use('/getSettings', require('./routes/getSettings'));
    app.use('/setSettings', require('./routes/setSettings'));
    app.use('/logout', require('./routes/logout'));
    app.use('/backup', require('./routes/backup'));
    app.use('/closeAccount', require('./routes/closeAccount'));
    app.use('/changePassword', require('./routes/changePassword'));

    // 404
    app.use(function(req, res, next) {
      return res.status(404).send('');
    });
  }));

  // user-specific variables
  proms.push(users.find().toArray()
  .then(docs => {
    for(let userDoc of docs) {
      const uid = userDoc._id;

      // semaphores
      userSems[uid] = semaphore(1);

      // scheduler
      retreiveNotificationKey(uid).then(async notificationKey => {
        if(!notificationKey) return;
        setScheduler(
          uid,
          userDoc.alarmClock,
          userDoc.enabledDays,
        );

        // restore broken scheduler
        const stackDoc = await stacks.findOne({uid});
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

          setTimeout(async () => {
            await workerFunction(uid)    // initial execution
            if(stackDoc.curNotifiedCount < nTotalNoti) {  // Was it not a test?
              // set worker for the rest
              setWorker(uid, setInterval(() => {
                workerFunction(uid);
              }, notiInterval*60*1000));
            }
          }, offset*60*1000);
        }
      });
    }
    logger.info('Schedulers are set.');
  }));

  // indices
  proms.push(terms.createIndex({timestamp: 1})
  .then(() => logger.info('Created terms.timestamp index(ascending)')));

  await Promise.all(proms);
  logger.info('* Annoyer server is ready.');
};

// add token to notification group
exports.setToken = async (uid, token) => {
  const notificationKey = await retreiveNotificationKey(uid);
  if(notificationKey) {
    //-- notification key is acquired --//
    // add token to the group
    let body = {
      operation: 'add',
      notification_key_name: uid,
      notification_key: notificationKey,
      registration_ids: [token],
    };
    const res = await fetch('https://fcm.googleapis.com/fcm/notification', { 
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'key=' + env.FCM_SERVER_KEY,
        'project_id': env.FCM_SENDER_ID,
      },
      body: JSON.stringify(body),
    });
    if(res.ok)  return res.json();
    else {
      logger.error(res);
      return false;
    }
  } else {
    //-- need to elicit a new one --//
    // create one and add token
    let body = {
      operation: 'create',
      notification_key_name: uid,
      registration_ids: [token],
    };
    const res = await fetch('https://fcm.googleapis.com/fcm/notification', { 
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'key=' + env.FCM_SERVER_KEY,
        'project_id': env.FCM_SENDER_ID,
      },
      body: JSON.stringify(body),
    });
    const json = (res.ok) ? await res.json() : {};
    if(json.error === 'notification_key already exists') {
      return retreiveNotificationKey();
    } else if(json.notification_key) {
      return json.notification_key;
    } else {
      throw new Error('No notification_key found: ' + JSON.stringify(json));
    }
  }
};

// del token from notification group
exports.delToken = async (uid, token) => {
  const notificationKey = await retreiveNotificationKey(uid);
  if(notificationKey) {
    //-- notification key is acquired --//
    // del token from the group
    let body = {
      operation: 'remove',
      notification_key_name: uid,
      notification_key: notificationKey,
      registration_ids: [token],
    };
    const res = await fetch('https://fcm.googleapis.com/fcm/notification', { 
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'key=' + env.FCM_SERVER_KEY,
        'project_id': env.FCM_SENDER_ID,
      },
      body: JSON.stringify(body),
    });
    if(res.ok)  return res.json();
    else {
      logger.error(res);
      return false;
    }
  } else return false;
};

// options = {minTimestamp, termIds}
// minTimestamp: (int) if given, return all terms
//                     of timestamps greater than or equal to this value
// termIds: (array) if given, return terms specified by this
// Caution: The preceding option overrides the rests. That is,
//          if minTimestamp is given, termIds is ignored.
//          It's designed as it is because there's no case to use
//          more than one option simultaneously.
// If the option is not given, all terms are returned.
exports.getTerms = (uid, options) => {
  // Add fields in all termTypes to send together.
  const projection = {
    _id:1, term: 1, type:1, def:1, ex:1, mnemonic:1, timestamp:1
  };
  const terms = db.collection('terms');
  let proms = [];
  
  if(options.minTimestamp) {
    //-- all terms of timestamps greater than or equal to --//
    return terms.find(
      {uid, timestamp:{$gte:options.minTimestamp}}, {projection}
    ).toArray();
  } else if(options.termIDs) {
    //-- get specific terms --//
    for(const _id of options.termIDs) {
      proms.push(terms.findOne({_id, uid}, {projection}));
    }
    return Promise.all(proms);
  } else {
    //-- get all terms --//
    return terms.find({uid}, {projection}).toArray();
  }
};

// mongoDB seems not allowing concurrency within a session
// Thereby, the following code is written suppressing concurrency.
exports.setTerms = async (uid, termInfos) => {
  const session = cli.startSession();
  session.startTransaction();
  
  try {
    const terms = db.collection('terms');
    let results = [];
  
    for(let newTermInfo of termInfos) {
      const term = newTermInfo.term || '';
      const type = newTermInfo.type;
      const level = parseInt(newTermInfo.level) || 1;
      const newTS = newTermInfo.timestamp;
      const tmpId = newTermInfo.tmpId;
      
      // get old term
      let oldTermInfo;
      if(tmpId) { // check tmpId first
        oldTermInfo = await terms.findOne({uid, tmpId}, {session});
      } else {
        const _id = new mongo.ObjectID(newTermInfo._id);
        oldTermInfo = await terms.findOne({uid, _id}, {session});
      }

      if(oldTermInfo && oldTermInfo.timestamp < newTS) {
        //-- modifying --//
        // do modify
        oldTermInfo.ex = newTermInfo.ex || '';
        oldTermInfo.mnemonic = newTermInfo.mnemonic || '';
        oldTermInfo.timestamp = newTS;

        // set term
        const _id = oldTermInfo._id;
        await terms.replaceOne({_id, uid}, oldTermInfo, {session});
        results.push({
          _id,
          timestamp: newTS,
          changes: {},
          isNew: false,
        });
        
        // update _id for reply
        newTermInfo._id = _id;
      } else if(!oldTermInfo) {
        //-- new --//
        const insertResult = await terms.insertOne({
          uid,
          type,
          term,
          def: newTermInfo.def || '',
          ex: newTermInfo.ex || '',
          mnemonic: newTermInfo.mnemonic || '',
          level,
          defScore: 0,
          exScore: 0,
          timestamp: newTS,
          tmpId,
        }, {session});

        // update _id for reply
        newTermInfo._id = insertResult.insertedId;

        // extract info for countingMap
        const changes = {};
        changes[level] = insertResult.insertedCount;
        results.push({
          type,
          level,
          timestamp: newTS,
          changes,
          _id: insertResult.insertedId,
          isNew: true,
        });
      } else {
        //-- nothing to do --//
        // update _id for reply
        newTermInfo._id = oldTermInfo._id;

        // placeholder
        results.push();
      }
    }

    // gather results
    let maxLastTS = 0, ids = [];
    for(const result of results) {
      if(result) {
        // maxLastTS
        maxLastTS = Math.max(maxLastTS, result.timestamp);

        // extract _id
        if(result.isNew) {
          ids.push(result._id.toHexString());
        }
      }
    }

    // maintain auxilary variables
    const options = {
      lastTimestamps: {terms: maxLastTS},
      countingMapChanges: combineLevelChanges(results),
      addChecksums: {terms:cs.getChecksums(ids)},
    };
    await updateUserInfo(uid, session, options);

    await session.commitTransaction();
    return termInfos;
  } catch(err) {
    logger.error(err.stack);
    await session.abortTransaction();
    throw err; // Rethrow so calling function sees error
  } finally {
    // close session
    session.endSession();
  }
};

// mongoDB seems not allowing concurrency within a session
// Thereby, the following code is written suppressing concurrency.
exports.delTerms = async (uid, termInfos) => {
  const session = cli.startSession();
  session.startTransaction();
  
  try {
    const terms = db.collection('terms');

    // delete
    let results = [];
    for(let termInfo of termInfos) {
      let deleteResult;
      if(termInfo._id.startsWith(conf.tmpIdPrefixes.term)) {
        //-- temp id --//
        const tmpId = termInfo._id;
        deleteResult = await terms.findOneAndDelete({tmpId, uid}, {session});
      } else {
        //-- real _id --//
        const _id = new mongo.ObjectID(termInfo._id);
        deleteResult = await terms.findOneAndDelete({_id, uid}, {session});
      }
      
      if(deleteResult.value) {
        const delResVal = deleteResult.value;
        // piece for updating auxiliary infos
        let result = {
          _id: delResVal._id,
          type: delResVal.type,
          changes: {},
          timestamp: termInfo.timestamp,
        };
        result.changes[delResVal.level] = -1;
        results.push(result);

        // update _id
        termInfo._id = delResVal._id;
      } else {
        results.push();
      }
    };
    
    // extract some infos
    let maxLastTS = 0, ids = [];   // don't change to "_ids". This bring MongoDB error.
    for(const result of results) {
      if(result) {
        // maxLastTS
        maxLastTS = Math.max(maxLastTS, result.timestamp);

        // extract _id
        ids.push(result._id.toHexString());
      }
    }

    // maintain auxilary variables
    const options = {
      lastTimestamps: {terms: maxLastTS},
      countingMapChanges: combineLevelChanges(results),
      subChecksums: {terms:cs.getChecksums(ids)},
    };
    await updateUserInfo(uid, session, options);

    await session.commitTransaction();
    return termInfos;
  } catch(err) {
    logger.error(err.stack);
    await session.abortTransaction();
    throw err; // Rethrow so calling function sees error
  } finally {
    session.endSession();
  }
};

exports.getSettings = async uid => {
  const users = db.collection('users');
  const doc = await users.findOne({_id: uid});
  return {
    alarmEnabled: doc.alarmEnabled,
    alarmClock: doc.alarmClock,
    enabledDays: doc.enabledDays,
    email: doc.email,
    timestamp: doc.lastTimestamps.settings,
  };
}

exports.setSettings = async (uid, data) => {
  const session = cli.startSession();
  session.startTransaction();
  
  try {
    const users = db.collection('users');
    const stacks = db.collection('stacks');
  
    let settingsChange = {};
    
    // alarmClock
    if('alarmClock' in data) {
      settingsChange.alarmClock = data.alarmClock;
    }
    
    // enabledDays
    if('enabledDays' in data) {
      let isValid = true;
      if(data.enabledDays.length === 7) {
        for(const x of data.enabledDays) {
          if(typeof x !== 'boolean') {
            isValid = false;
            break;
          }
        }
      } else {
        isValid = false;
      }
      
      if(isValid) {
        settingsChange.enabledDays = data.enabledDays;
      } else {
        throw new Error('Invalid enabled days.');
      }
    }

    // filter out if nothing to do
    if(Object.keys(settingsChange).length === 0) return;
    
    // if given settings are new ones
    let doc = await users.findOne({_id: uid});
    if(doc.lastTimestamps[conf.timestampFields.settings] < data.timestamp) {
      // update with given settings
      Object.assign(doc, settingsChange);
      doc.lastTimestamps[conf.timestampFields.settings] = data.timestamp;
      await users.replaceOne({_id: uid}, doc, {session});


      // refresh scheduler
      if('alarmClock' in settingsChange
        || 'enabledDays' in settingsChange) {
        await stacks.deleteOne({uid}, {session});
        const doc = await users.findOne({_id:uid}, {session});
        await setScheduler(uid, doc.alarmClock, doc.enabledDays);
      }
    }

    // close session
    await session.commitTransaction();
  } catch(err) {
    logger.error(err.stack);
    await session.abortTransaction();
    throw err; // Rethrow so calling function sees error
  } finally {
    session.endSession();
  }
}

exports.getStack = async (uid, stackId) => {
  const stacks = db.collection('stacks');

  // make filter
  let filter = {uid};
  if(stackId) {
    filter['_id'] = new mongo.ObjectId(stackId);
  }

  // look up
  const doc = await stacks.findOne(filter);
  if(doc) {   // deliver only if there's a stack
    return {
      _id: doc._id,
      stack: doc.stack,
      timestamp: doc.timestamp,
    };
  } else {
    throw new Error('no stack');
  }
}

exports.changePassword = async (uid, oldPassword, newPassword) => {
  const session = cli.startSession();
  session.startTransaction();
  
  try {
    const users = db.collection('users');
  
    // change only if the old password is matched
    const result = await users.updateOne({
      _id: uid,
      password: hashPassword(oldPassword),
    }, {$set: {password: hashPassword(newPassword)}},
    {session});

    // check
    if(result.modifiedCount === 0) {
      //-- failed --//
      throw new Error('Failed');
    }
  
    //-- success --//
    // close session
    await session.commitTransaction();
  } catch(err) {
    logger.error(err.stack);
    await session.abortTransaction();
    throw err; // Rethrow so calling function sees error
  } finally {
    session.endSession();
  }
}

// mongoDB seems not allowing concurrency within a session
// Thereby, the following code is written suppressing concurrency.
exports.applyTestResult = async (uid, testResults, newTimestamp) => {
  const session = cli.startSession();
  session.startTransaction();
  
  try {
    const terms = db.collection('terms');
    const users = db.collection('users');
    const stacks = db.collection('stacks');

    // prevent duplicate applying
    const userDoc = await users.findOne({_id: uid}, {session});
    if(newTimestamp <= userDoc.lastTimestamps.testResults)  return;

    let results = [];
    for(let _id in testResults) {
      _id = new mongo.ObjectID(_id);
      const testResult = testResults[_id];
      const doc = await terms.findOne({_id, uid}, {session});
  
      if(!doc) return;

      let oldLevel = doc.level, newLevel;
      if(doc.type === conf.termTypes.default) {
        const defScoreChange = testResult.defScoreChange || 0;
        const exScoreChange = testResult.exScoreChange || 0;

        // apply score change
        doc.defScore += defScoreChange;
        doc.exScore += exScoreChange;

        // check level change
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

        // apply
        await terms.replaceOne({_id}, {$set: doc}, {session});

        // calculate level change
        let result = {type: doc.type, changes:{}};
        if(oldLevel !== newLevel) {
          result.changes[oldLevel] = -1;
          result.changes[newLevel] = 1;
        }
        results.push(result);
      } else if(prevType === conf.termTypes.audioClip) {
        throw new Error('oisadmfoa0uiyugaasahsmkmals;');
      }
    }

    // maintain auxilary variables
    const options = {
      countingMapChanges: combineLevelChanges(results),
      lastTimestamps: {testResults: newTimestamp},
    };
    await updateUserInfo(uid, session, options);

    // cleaning up
    clearWorker(uid);
    await stacks.deleteOne({uid}, {session});

    //-- success --//
    // close session
    await session.commitTransaction();
  } catch(err) {
    logger.error(err.stack);
    await session.abortTransaction();
    throw err; // Rethrow so calling function sees error
  } finally {
    session.endSession();
  }
};

exports.sendSync = (uid, type, syncInfos) => {
  return exports.sendMsg(uid, conf.notiTypes.sync, {type, syncInfos});
};

exports.sendMsg = async (uid, notiType, data) => {
  data.notiType = notiType;
  try {
    const notificationKey = await retreiveNotificationKey(uid);
    if(notificationKey) {
      return await sendToGroup(notificationKey, data);
    } else {
      return false;
    }
  } catch(err) {
    logger(err.stack);
  }
};

// No return. 'origin' argument will be changed.
exports.mergeCountingMaps = (origin, change) => {
  for(var lvl in change) {
    if(lvl in origin) {
      origin[lvl] += change[lvl];
    } else {
      origin[lvl] = change[lvl];
    }
  }
};
  
// delete elements whose value is 0
exports.trimCountingMap = countingMap => {
  for(var lvl in countingMap) {
    if(countingMap[lvl] === 0)
      delete countingMap[lvl];
  }
};

exports.login = async (email, password) => {
  const users = db.collection('users');
  password = hashPassword(password);
  const doc = await users.findOne({email});
  if(doc && password === doc.password) {
    return doc._id;
  } else {
    throw new Error('Incorrect ID/password.');
  }
}

exports.logout = session => {
  const uid = session.uid;
  let proms = [];

  // remove token from the group
  proms.push(retreiveNotificationKey(uid)
  .then(async notificationKey => {
    let body = {
      operation: 'remove',
      notification_key_name: uid,
      notification_key: notificationKey,
      registration_ids: [session.token],
    };
    const res = await fetch('https://fcm.googleapis.com/fcm/notification', { 
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'key=' + env.FCM_SERVER_KEY,
        'project_id': env.FCM_SENDER_ID,
      },
      body: JSON.stringify(body),
    });
    if(res.ok)  return res.json();
    else {
      logger.error(res);
      return false;
    }
  }));

  // destroy session
  proms.push(new Promise((resolve, reject) => {
    session.destroy(function(err) {
      if(err) reject(err);
      else    resolve();
    });
  }));
  
  return Promise.all(proms);
};

exports.register = async (email, password) => {
  password = hashPassword(password);

  // register
  const users = db.collection('users');
  const doc = await users.findOne({email});
  if(doc) {
    throw new Error('Your email is already enrolled. Try another.');
  }

  // countingMap
  let countingMap = {};
  Object.keys(conf.termTypes).forEach(termType => {countingMap[termType] = {}});

  // enroll new account
  const result = await users.insertOne(Object.assign({},
    conf.defaultValues.settings,
    {checksums: conf.defaultValues.checksums},
    {lastTimestamps: conf.defaultValues.lastTimestamps},
    {email, password, countingMap},
  ));
  const uid = result.insertedId;

  // semaphores
  userSems[uid] = semaphore(1);
  
  // successfully added
  logger.info('New account: ' + email);

  return uid;
}

exports.getAuxInfos = async uid => {
  const doc = await db.collection('users').findOne({_id: uid});
  return {
    lastTimestamps: doc.lastTimestamps,
    checksums: doc.checksums,
  };
}

exports.backup = async uid => {
  const terms = db.collection('terms');
  const docs = await terms.find({uid}).project(importExportProject).toArray();
  const json2csvParser = new Json2csvParser({fields: conf.importExportFields});
  return json2csvParser.parse(docs);
}

exports.closeAccount = async uid => {
  const session = cli.startSession();
  session.startTransaction();

  try {
    const users = db.collection('users');
    const terms = db.collection('terms');
    const tokens = db.collection('tokens');
    const stacks = db.collection('stacks');
    // const sessions = db.collection('sessions');

    // get userInfo
    const userInfo = await users.findOne({_id: uid});

    // destroy user data
    // taking advantage of concurrency of MongoDB 4.0.5 has failed
    await users.deleteOne({_id: uid}, {session});
    await terms.deleteMany({uid}, {session});
    await tokens.deleteMany({uid}, {session});
    await stacks.deleteMany({uid}, {session});
    // proms.push(sessions.deleteMany({"session.uid": uid}, {session}));    // This brings error during session opened
    clearWorker(uid);

    await session.commitTransaction();
    return userInfo;
  } catch(err) {
    logger.error(err.stack);
    await session.abortTransaction();
    throw err;
  } finally {
    // close session
    session.endSession();
  }
}

// Return the stack
// currently default terms only
async function createStack(uid) {
  const terms = db.collection('terms');
  const users = db.collection('users');

  const doc = await users.findOne({_id: uid});

  // default type for now
  const countingMapDefault = doc.countingMap[conf.termTypes.default];

  let curTotalNumTerms = 0;
  for(const lvl in countingMapDefault) {
    curTotalNumTerms += countingMapDefault[lvl];
  }
  if(curTotalNumTerms >= stackSize) {
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
    let proms = [];
    for(const lvl in numTerms) {
      proms.push(terms.find({uid, level:parseInt(lvl)})
      .project({_id:1}).toArray()
      .then(result => {
        let sample=[];
        if(numTerms[lvl] < result.length) {
          let sampleSet = {};
          // pick up numTerms[lvl] samples
          let i=0;
          for(;i<numTerms[lvl];) {
            const x = Math.floor(Math.random()*result.length);
            if(!(x in sampleSet)) {
              sampleSet[x] = 1;
              i++; 
            }
          }
          for(const idx in sampleSet)
            sample.push(result[idx]);
        } else {
          // pick up entire result
          sample = result;
        }
        return sample;
      }));
    }
    const samples = await Promise.all(proms);
    let retval = [];
    for(var r1 of samples) {
      for(var r2 of r1) {
        retval.push(r2._id);
      }
    }
    return retval;
  } else {
    return [];    // empty stack
  }
}

// compose & send practice, test notification
async function workerFunction(uid) {
  const stacks = db.collection('stacks');
  const doc = await stacks.findOne({uid});

  try {
    // check no stack
    if(!doc) {
      clearWorker(uid);
      return;
    }
    
    const stackId = doc._id;
    const {curNotifiedCount} = doc;

    // build msg
    if(curNotifiedCount >= nTotalNoti) {
      //-- test --//
      // send
      await exports.sendMsg(uid, conf.notiTypes.test, {stackId});
  
      // cleaning up
      clearWorker(uid);
      stacks.deleteOne({uid});
    } else {
      //-- practice --//
      // set current indice
      const curIndices = [];
      let j, i = (curNotifiedCount * nTermsNoti) % stackSize;
      for(j=0;j<nTermsNoti;j++) {
        curIndices.push((i+j) % stackSize);
      }

      // send
      await exports.sendMsg(uid, conf.notiTypes.practice, {stackId, curIndices});
    }
    
    // increment notification counter
    await stacks.updateOne({uid}, {$set: {
      curNotifiedCount: curNotifiedCount+1,
    }});
  } catch(err) {logger.error(err.stack)}
}

function setWorker(uid, obj) { workers[uid] = obj }
function clearWorker(uid) {
  clearTimeout(workers[uid]);
  clearInterval(workers[uid]);
  delete workers[uid];
}

async function sendToGroup(notificationKey, data) {
  const body = {to: notificationKey, data};
  const res = await fetch('https://fcm.googleapis.com/fcm/send', { 
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'key=' + env.FCM_SERVER_KEY,
    },
    body: JSON.stringify(body),
  });
  if(res.ok)  return res.json();
  else {
    logger.error(res);
    return {success: 0, failure: 0};
  }
}

async function retreiveNotificationKey(uid) {
  const res = await fetch('https://fcm.googleapis.com/fcm/notification?notification_key_name='+uid, {
    method: 'get',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'key=' + env.FCM_SERVER_KEY,
      'project_id': env.FCM_SENDER_ID,
    },
  });
  const json = (res.ok) ? await res.json() : {notification_key: null};
  return json.notification_key;
}

function combineLevelChanges(results) {
  let countingMapChanges = {};

  // init
  for(const termType of Object.keys(conf.termTypes)) {
    countingMapChanges[termType] = {};
  }

  // process
  for(const result of results) {
    if(result) {    // This is needed as some query may return null
      let countingMapChange = countingMapChanges[result.type];
      const changes = result.changes;

      for(const level of Object.keys(changes)) {
        if(countingMapChange[level]) {
          countingMapChange[level] += changes[level];
        } else {
          countingMapChange[level] = changes[level];
        }
      }
    }
  }

  // trim
  for(const termType of Object.keys(countingMapChanges)) {
    exports.trimCountingMap(countingMapChanges[termType]);
  }
  
  return countingMapChanges;
}

async function updateUserInfo(uid, session, options) {
  const users = db.collection('users');
  let doc = await users.findOne({_id: uid}, {session});
  
  if(!doc)  throw new Error('No matching user');

  // last timestamps
  if(options.lastTimestamps) {
    let docLTS = doc.lastTimestamps;
    const optLTS = options.lastTimestamps;
    for(const type in optLTS) {
      if(docLTS[type] < optLTS[type]) {
        docLTS[type] = optLTS[type]
      }
    }
    doc.lastTimestamps = docLTS;
  }

  // counting map
  if(options.countingMapChanges) {
    const optCntMapChgs = options.countingMapChanges;
    for(const termType in optCntMapChgs) {
      const countingMapChange = optCntMapChgs[termType];
      if(Object.keys(countingMapChange).length > 0) {
        // merge & trim
        exports.mergeCountingMaps(
          doc.countingMap[termType],
          countingMapChange
        );
        exports.trimCountingMap(doc.countingMap[termType]);
      }
    }
  }

  // add checksums
  if(options.addChecksums) {
    const optAddChecksums = options.addChecksums;
    for(const type in optAddChecksums) {
      let docCS = doc.checksums[type];
      for(const optionCS of optAddChecksums[type]) {
        docCS = cs.addChecksum(docCS, optionCS);
      }
      doc.checksums[type] = docCS;
    }
  }

  // subtract checksums
  if(options.subChecksums) {
    const optSubChecksums = options.subChecksums;
    for(const type in optSubChecksums) {
      let docCS = doc.checksums[type];
      for(const optionCS of optSubChecksums[type]) {
        docCS = cs.subChecksum(docCS, optionCS);
      }
      doc.checksums[type] = docCS;
    }
  }

  return users.updateOne({_id: uid}, {$set: doc}, {session});
}

function setScheduler(uid, alarmClock, enabledDays) {
  const stacks = db.collection('stacks');
  
  // clear previous schedule
  if(uid in schedules) {
    schedules[uid].cancel();
  }
  clearWorker(uid);

  // check to disable scheduler
  if(enabledDays.every(x => {return !x})) {
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
  if(enabledDays.every(x => {return x})) {
    rule += '*';
  } else {
    for(var i=0;i<7;i++) {
      if(enabledDays[i])
        rule += i+',';
    }
    rule = rule.substring(0, rule.length-1);
  }

  
  // set schedule
  schedules[uid] = schedule.scheduleJob(rule, async () => {
    const session = cli.startSession();
    session.startTransaction();

    try {
      // create a stack
      const stack = await createStack(uid);
      if(stack.length < stackSize) {
        //-- not enough terms --//
        // demand at least <stackSize> terms
        const data = {
          msg: 'Set at least ' + stackSize + ' terms to kick off!',
        };
        exports.sendMsg(uid, conf.notiTypes.announcement, data);
        return;
      } else {
        //-- enough terms --//
        const timestamp = Date.now();

        // save the stack
        await stacks.insertOne({
          uid,
          curNotifiedCount: 0,
          stack,
          timestamp,
        }, {session});

        // maintain auxilary variables
        const options = { lastTimestamps: {} };
        options.lastTimestamps[conf.timestampFields.stack] = timestamp;
        await updateUserInfo(uid, session, options);

        await session.commitTransaction();
      }
  
      // run initial execution
      workerFunction(uid);
  
      // set worker
      clearWorker(uid);
      setWorker(uid, setInterval(() => {
        workerFunction(uid);
      }, notiInterval*60*1000));
    } catch(err) {
      logger.error(err.stack);
      await session.abortTransaction();
    } finally {
      // close session
      session.endSession();
    }
  });
};

function hashPassword(password) {
  return crypto.createHmac('sha1', secret).update(password).digest('hex');
};

module.exports = exports;