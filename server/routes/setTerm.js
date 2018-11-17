var express = require('express');
var router = express.Router();
var common = require('../common');

router.post('/', function(req, res, next) {
  let term = req.body.term;
  if(term) {
    return common.setTerms(
      [term],
      req.session.uid,
      req.body.isModifying || false
    ).then(() => {
      return res.json({result: true});
    });
  } else {
    return res.json({result: false, msg: 'No term is received.'});
  }
});

module.exports = router;
