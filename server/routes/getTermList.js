var express = require('express');
var router = express.Router();
const common = require('../common');
const logger = require('../logger');

router.post('/', function(req, res, next) {
  const sortBy = req.body.sortBy || '';
  const descending = req.body.descending || false;
  const terms = common.db.collection('terms');

  let t = terms.find({uid: req.session.uid}).project({_id:1, term:1});
  if(sortBy === 'term') {
    let sort = {};
    sort[sortBy] = (descending) ? -1 : 1;
    t = t.sort(sort);
  }
  return t.toArray()
  .then(docs => {
    return res.json({result: true, terms: docs});
  }).catch((err) => {
    logger.error('Failed to get terms by ' + req.session.user
          + '\nReason: ' + err);
    return res.json({result: false});
  });
});

module.exports = router;
