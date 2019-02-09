const express = require('express');
const router = express.Router();
const common = require('../common');
const conf = require('../../lib/conf');
const logger = require('../logger');

router.post('/', async (req, res, next) => {
  const uid = req.session.uid;
  const data = req.body;

  // reply with ACK
  res.json({result: true});

  common.userSems[uid].take(async () => {
    try {
      await common.setSettings(uid, data);
      await common.sendSync(uid, conf.syncTypes.setSettings, data);
    } catch(err) {
      logger.error(err.stack);
    } finally {
      common.userSems[uid].leave();
    }
  });
});

module.exports = router;
