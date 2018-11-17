var express = require('express');
var router = express.Router();
var mongo = require('mongodb');
const common = require('../common');

router.post('/', function(req, res, next) {
  const _id = req.body._id || '';
  const terms = common.db.collection('terms');

  if(_id !== '') {
    return terms.findOne({
      _id: new mongo.ObjectId(_id),
      uid: req.session.uid
    }).then((doc) => {
      if(doc.type === common.termTypes.default) {
        return res.json({result: true, term: {
          _id: doc._id.toHexString(),
          term: doc.term,
          type: doc.type,
          def: doc.def,
          ex: doc.ex,
          mnemonic: doc.mnemonic,
        }});
      }
    });
  }
});

module.exports = router;
