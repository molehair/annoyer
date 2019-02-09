const express = require('express');
const router = express.Router();
const common = require('../common');

router.get('/', async (req, res, next) => {
  const uid = req.session.uid;
  common.userSems[uid].take(async () => {
    try {
      const csv = await common.backup(uid);
      return res.send(csv);
    } catch(err) {
      logger.error(err.stack);
    } finally {
      common.userSems[uid].leave();
    }
  });
});

module.exports = router;
