const express = require('express');
const router = express.Router();
const common = require('../common');
const logger = require('../logger');

router.post('/', function(req, res, next) {
  return common.applyTestResult(
    req.body.testResults,
    req.session.uid
  ).then(() => {
    return res.json({result: true});
  }).catch(err => {
    logger.log('error', err);
    return res.json({result: false, msg: err.toString()});
  });
});

module.exports = router;
