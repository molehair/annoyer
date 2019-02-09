const express = require('express');
const router = express.Router();
const common = require('../common');
const logger = require('../logger');
const conf = require('../../lib/conf');

router.post('/', (req, res, next) => {
  const uid = req.session.uid;
  const stackId = req.body.stackId;
  const testResults = req.body.testResults;
  const timestamp = req.body.timestamp;
  
  // quisk ACK
  res.json({result: true});

  common.userSems[uid].take(async () => {
    try {
      await common.applyTestResult(uid, testResults, timestamp);
      common.sendSync(uid, conf.syncTypes.applyTestResults,
        {result: true, stackId, timestamp}
      );
    } catch(err) {
      logger.error(err.stack);
      common.sendSync(uid, conf.syncTypes.applyTestResults,
        {result: false, stackId, timestamp, msg: err.message}
      );
    } finally {
      common.userSems[uid].leave();
    }
  });
});

module.exports = router;
