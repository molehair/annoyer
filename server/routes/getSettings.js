var express = require('express');
var router = express.Router();
const common = require('../common');

router.get('/', function(req, res, next) {
  const users = common.db.collection('users');

  return users.findOne({_id: req.session.uid})
  .then(doc => {
    return res.json({result: true, settings: {
      doPractice: doc.doPractice,
      alarmClock: doc.alarmClock,
      enabledDays: doc.enabledDays,
      email: doc.email,
    }});
  });
});

module.exports = router;
