var express = require('express');
var router = express.Router();
const common = require('../common');

router.get('/', function(req, res, next) {
  let promises = [];
  const users = common.db.collection('users');
  const terms = common.db.collection('terms');
  const tokens = common.db.collection('tokens');
  const stacks = common.db.collection('stacks');
  const sessions = common.db.collection('sessions');
  
  // user data
  const uid = req.session.uid;
  promises.push(users.deleteOne({_id: uid}));
  promises.push(terms.deleteMany({uid}));
  promises.push(tokens.deleteMany({uid}));
  promises.push(stacks.deleteMany({uid}));
  promises.push(sessions.deleteMany({"session.uid": uid}));

  return Promise.all(promises).then(() => {
    return res.json({result: true});
  }).catch(err => {
    return res.json({result: false, msg: err.toString()});
  });
});

module.exports = router;
