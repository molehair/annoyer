const express = require('express');
const router = express.Router();
const common = require('../common');
const logger = require('../logger');

router.post('/', async (req, res, next) => {
  try {
    await common.delToken(req.session.uid, req.body.token);
    req.session.token = req.body.token;
    return res.json({result: true});
  } catch(err) {
    logger.error(err.stack);
    return res.json({result: false, msg: err.message});
  }
});

module.exports = router;