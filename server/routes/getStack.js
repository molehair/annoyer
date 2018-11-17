var express = require('express');
var router = express.Router();
const common = require('../common');
var mongo = require('mongodb');

router.post('/', function(req, res, next) {
  const stackId = req.body.stackId || '';
  const stacks = common.db.collection('stacks');
  const terms = common.db.collection('terms');

  return stacks.findOne({
    _id: new mongo.ObjectId(stackId),
    uid: req.session.uid
  }).then(doc => {
    let promises = [];
    for(var termId of doc.stack) {
      promises.push(terms.findOne({_id: new mongo.ObjectId(termId)})
      .then(doc => {
        if(doc) {
          return {
            _id: doc._id.toHexString(),
            term: doc.term,
            type: doc.type,
            def: doc.def,
            ex: doc.ex,
            mnemonic: doc.mnemonic,
          };
        } else
          return null;
      }));
    }
    return Promise.all(promises).then(docs => {
      return res.json({result: true, stack: docs});
    });
  });
});

module.exports = router;
