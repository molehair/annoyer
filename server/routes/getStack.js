const express = require('express');
const router = express.Router();
const common = require('../common');
const logger = require('../logger');

router.post('/', (req, res, next) => {
  const stackId = req.body._id;
  const uid = req.session.uid;
  
  common.userSems[uid].take(async () => {
    try {
      let stackInfo = await common.getStack(uid, stackId);
      stackInfo.result = true;

      res.json(stackInfo);
    } catch(err) {
      if(err.message !== 'no stack') {
        logger.error(err.stack);
      }
      res.json({result: false, msg: err.message});
    } finally {
      common.userSems[uid].leave();
    }
  });
});

module.exports = router;
