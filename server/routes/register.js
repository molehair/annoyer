var express = require('express');
var router = express.Router();
var common = require('../common');
const logger = require('../logger');
const semaphore = require('semaphore');

const ABORT_PROMISE_CHAIN = 'apc';

router.post('/', function(req, res, next) {
  const email = req.body.email;
  const password = common.hashPassword(req.body.password);

  // already logged in?
  if(typeof req.session.user !== 'undefined')
    return res.json({result: false, msg: 'Already logged in'});
  
  // register
  const users = common.db.collection('users');
  return users.findOne({email : email})
  .then(doc => {
    if(doc) {
      res.json({result: false, msg: 'Your email is already enrolled. Try another.'});
      throw new Error(ABORT_PROMISE_CHAIN);
    }
    return null;
  }).then(() => {
    // enroll new account
    return users.insertOne({
      email,
      password,
      doPractice: false,
      alarmClock: 60,   // UTC 24-time, min
      enabledDays: [false, false, false, false, false, false, false], // Sun, Mon, ..., Sat
      countingMapDefault: {},
      countingMapAudioClip: {},
    });
  }).then(result => {
    // set session data
    req.session.uid = result.insertedId;
    req.session.user = email;

    // semaphores
    common.userSems[req.session.uid] = semaphore(1);
    
    // successfully added
    logger.info('New account: ' + email);
    return res.json({result: true});
  }).catch(err => {
    if(err.message !== ABORT_PROMISE_CHAIN) {
      res.status(500).json({result: false, msg: 'Server Error'});
      logger.error(err.stack);
    }
  });
});

module.exports = router;
