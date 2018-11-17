var express = require('express');
var router = express.Router();
var common = require('../common');

router.post('/', function(req, res, next) {
  const data = req.body;
  const users = common.db.collection('users');
  let settingChange = {};

  // password
  if('oldPassword' in data && 'newPassword' in data) {
    // check old password
    return users.updateOne({
      _id: req.session.uid,
      password: common.hashPassword(data.oldPassword),
    }, {$set: {password: common.hashPassword(data.newPassword)}
    }).then(result => {
      return res.json({result: (result.modifiedCount === 1)});
    });
  }

  // doPractice
  if('doPractice' in data && typeof data.doPractice === 'boolean') {
    settingChange.doPractice = data.doPractice;
  }

  // alarmClock
  if('alarmClock' in data) {
    settingChange.alarmClock = data.alarmClock;
  }

  // enabledDays
  if('enabledDays' in data) {
    let isValid = true;
    if(data.enabledDays.length === 7) {
      for(var x of data.enabledDays) {
        if(typeof x !== 'boolean')
          isValid = false;
      }
    } else
      isValid = false;

    if(isValid) {
      settingChange.enabledDays = data.enabledDays;
    } else
      return res.json({result: false, msg: 'Invalid enabled days.'});
  }

  // save & resetup
  if(Object.keys(settingChange).length) {
    users.findOneAndUpdate({_id: req.session.uid}, {
      $set: settingChange
    }, {returnOriginal: false}).then(result => {
      const doc = result.value;
      // refresh scheduler
      if('doPractice' in settingChange 
        || 'alarmClock' in settingChange
        || 'enabledDays' in settingChange) {
        common.setScheduler(
          req.session.uid,
          // req.session.uid.toString(),
          doc.doPractice,
          doc.alarmClock,
          doc.enabledDays);
      }
    });
  }
  return res.json({result: true, change: settingChange});
});

module.exports = router;
