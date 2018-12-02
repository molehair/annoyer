var express = require('express');
var router = express.Router();
var common = require('../common');

router.post('/', function(req, res, next) {
  const termIDs = req.body.termIDs;
  
  if(termIDs) {
    common.userSems[req.session.uid].take(() => {
      return common.delTerms(termIDs, req.session.uid).then(() => {
        common.userSems[req.session.uid].leave();
        return res.json({result: true});
      });
    });
  } else {
    return res.json({result: false, msg: 'No term is received.'});
  }
});

module.exports = router;
