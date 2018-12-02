const express = require('express');
const router = express.Router();
const common = require('../common');
const logger = require('../logger');

router.post('/', function(req, res, next) {
  const data = req.body;
  const users = common.db.collection('users');
  const stacks = common.db.collection('stacks');
  const uid = req.session.uid;
  let settingChange = {};

  // password
  if('oldPassword' in data && 'newPassword' in data) {
    // check old password
    return users.updateOne({
      _id: uid,
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
      let x;
      for(x of data.enabledDays) {
        if(typeof x !== 'boolean')
        isValid = false;
      }
    } else
    isValid = false;
    
    if(isValid) {
      settingChange.enabledDays = data.enabledDays;
    } else {
      return res.json({result: false, msg: 'Invalid enabled days.'});
    }
  }
  
  // save & resetup
  if(Object.keys(settingChange).length) {
    common.userSems[uid].take(() => {
      return users.findOneAndUpdate({_id: uid}, {
        $set: settingChange
      }, {returnOriginal: false}).then(result => {
        const doc = result.value;
        
        // refresh scheduler
        if('doPractice' in settingChange 
          || 'alarmClock' in settingChange
          || 'enabledDays' in settingChange) {
          stacks.deleteOne({uid}).then(() => {
            common.setScheduler(
              uid,
              doc.doPractice,
              doc.alarmClock,
              doc.enabledDays
            );
          });
        }
        common.userSems[uid].leave();
        return res.json({result: true, change: settingChange});
      }).catch(err => {
        logger.error(err.stack);
        common.userSems[uid].leave();
        return res.json({result: false, msg: err.toString()});
      });
    });
  } else {
    return res.json({result: true, change: settingChange});
  }
});

module.exports = router;
