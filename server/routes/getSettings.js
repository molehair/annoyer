const express = require('express');
const router = express.Router();
const common = require('../common');
const logger = require('../logger');

router.get('/', async (req, res, next) => {
  const uid = req.session.uid;
  common.userSems[uid].take(async () => {
    try {
      let settings = await common.getSettings(uid);
      settings.result = true;
      res.json(settings);
    } catch(err) {
      logger.error(err.stack);
    } finally {
      common.userSems[uid].leave();
    }
  });
});

module.exports = router;
