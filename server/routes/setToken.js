var express = require('express');
var router = express.Router();
var common = require('../common');

router.post('/', function(req, res, next) {
  common.setToken(req.session.uid, req.body.token)
  .then(() => {
    req.session.token = req.body.token;
    return res.json({result: true});
  }).catch(err => {
    return res.json({result: false, msg: err.toString()});
  });
});

module.exports = router;