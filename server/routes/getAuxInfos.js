const express = require('express');
const router = express.Router();
const common = require('../common');
const logger = require('../logger');

router.get('/', async (req, res, next) => {
  const uid = req.session.uid;
  
  common.userSems[uid].take(async () => {
    try {
      let auxInfos = await common.getAuxInfos(req.session.uid);
      auxInfos.result = true;
      res.json(auxInfos);
    } catch(err) {
      logger.error(err.stack);
      res.json({result: false, msg: err.message});
    } finally {
      common.userSems[uid].leave();
    }
  });
});

module.exports = router;
