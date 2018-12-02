const express = require('express');
const router = express.Router();
const common = require('../common');
const logger = require('../logger');

router.post('/', function(req, res, next) {
  const uid = req.session.uid;
  common.userSems[uid].take(() => {
    return common.applyTestResult(
      req.body.testResults,
      uid
    ).then(() => {
      common.userSems[uid].leave();
      return res.json({result: true});
    }).catch(err => {
      common.userSems[uid].leave();
      logger.error(err.stack);
      return res.json({result: false, msg: err.toString()});
    });
  });
});

module.exports = router;
