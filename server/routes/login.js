const express = require('express');
const router = express.Router();
const common = require('../common');

router.post('/', async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  try {
    const uid = await common.login(email, password);
    req.session.uid = uid;
    return res.json({result: true});
  } catch(err) {
    return res.json({result: false, msg: err.message});
  }
});

module.exports = router;
