var express = require('express');
var router = express.Router();
var common = require('../common');

router.post('/', function(req, res, next) {
  const email = req.body.email;
  const password = common.hashPassword(req.body.password);

  const users = common.db.collection('users');

  users.findOne({email: email})
  .then(doc => {
    if(doc && password === doc.password) {
      req.session.uid = doc._id;
      req.session.user = email;
      return res.json({result: true});
    } else {
      return res.json({result: false, msg: 'Incorrect ID/password.'});
    }
  });
});

module.exports = router;
