const express = require('express');
const router = express.Router();
const common = require('../common');
const logger = require('../logger');

router.post('/', async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  try {
    const uid = await common.register(email, password);
    
    // set session data
    req.session.uid = uid;
    
    return res.json({result: true});
  } catch(err) {
    logger.error(err.stack);
    return res.json({result: false, msg: err.message});
  }
});

module.exports = router;
