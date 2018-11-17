var express = require('express');
var router = express.Router();
const common = require('../common');

router.get('/', function(req, res, next) {
  const stacks = common.db.collection('stacks');

  stacks.findOne({uid: req.session.uid}, {_id: 1})
  .then(doc => {
    if(doc) {
      return res.json({
        result: true,
        user: req.session.user,
        stackId: doc._id.toHexString(),
      });
    } else if(req.session.user) {
      return res.json({
        result: true,
        user: req.session.user,
      });
    } else {
      return res.json({result: false});
    }
  });
});

module.exports = router;
