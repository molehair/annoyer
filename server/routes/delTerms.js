const express = require('express');
const router = express.Router();
const common = require('../common');
const logger = require('../logger');
const conf = require('../../lib/conf.js');

router.post('/', (req, res, next) => {
  let termInfos = req.body.termInfos;
  const uid = req.session.uid;
  
  // reply with ACK
  res.json({result: true});
  
  if(!termInfos) return;
  
  common.userSems[uid].take(async () => {
    try {
      // del
      // For sending _id created by server, update termInfos
      termInfos = await common.delTerms(uid, termInfos);

      // send result
      await common.sendSync(uid, conf.syncTypes.delTerm, termInfos);
    } catch(err) {
      logger.error(err.stack);
    } finally {
      common.userSems[uid].leave();
    }
  });
});

module.exports = router;
