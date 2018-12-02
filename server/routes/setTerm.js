const express = require('express');
const router = express.Router();
const common = require('../common');

router.post('/', function(req, res, next) {
  const term = req.body.term;
  const uid = req.session.uid;
  if(term) {
    common.userSems[uid].take(() => {
      return common.setTerms(
        [term],
        uid,
        req.body.isModifying || false
      ).then(() => {
        common.userSems[uid].leave();
        return res.json({result: true});
      });
    });
  } else {
    return res.json({result: false, msg: 'No term is received.'});
  }
});

module.exports = router;
