const express = require('express');
const logger = require('../logger');
const common = require('../common');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    await common.logout(req.session);
    return res.json({result: true});
  } catch(err) {
    logger.error(err.stack);
    return res.json({result: false, msg: err.message});
  }
});

module.exports = router;
