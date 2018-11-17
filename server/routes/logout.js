const express = require('express');
const logger = require('../logger');
const common = require('../common');
const router = express.Router();

router.get('/', function(req, res, next) {
  return common.logout(req.session).then(() => {
    return res.json({result: true});
  }).catch(err => {
    logger.log('error', err);
    return res.json({result: false, msg: err.toString()});
  });
});

module.exports = router;
