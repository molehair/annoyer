const express = require('express');
const router = express.Router();
const common = require('../common');
const logger = require('../logger');

router.post('/', async (req, res, next) => {
  const minTimestamp = req.body.minTimestamp;
  const uid = req.session.uid;

  common.userSems[uid].take(async () => {
    try {
      const termInfos = await common.getTerms(uid, {minTimestamp});
      return res.json({result: true, termInfos});
    } catch(err) {
      logger.error(err.stack);
      return res.json({result: false, msg: err.message});
    } finally {
      common.userSems[uid].leave();
    }
  });
});

module.exports = router;