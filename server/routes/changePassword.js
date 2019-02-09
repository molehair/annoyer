const express = require('express');
const router = express.Router();
const common = require('../common');

router.post('/', (req, res, next) => {
  const oldPassword = req.body.oldPassword;
  const newPassword = req.body.newPassword;
  const uid = req.session.uid;

  return common.userSems[uid].take(async () => {
    try {
      await common.changePassword(uid, oldPassword, newPassword);
      res.json({result: true});
    } catch(err) {
      res.json({result: false, msg: err.message});
    }
    common.userSems[uid].leave();
  });
});

module.exports = router;
