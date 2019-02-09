const express = require('express');
const router = express.Router();
const common = require('../common');
const logger = require('../logger');
const conf = require('../../lib/conf.js');

router.get('/', async (req, res, next) => {
  const uid = req.session.uid;
  try {
    const userInfo = await common.closeAccount(uid);

    // send close account msg to all clients
    await common.sendSync(uid, conf.syncTypes.closeAccount, {email: userInfo.email});
    
    // send ACK to the sender
    res.json({result: true});
  } catch(err) {
    logger.error(err.stack);
    res.json({result: false, msg: err.message});
  }
});

module.exports = router;
