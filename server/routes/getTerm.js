const express = require('express');
const mongo = require('mongodb');
const router = express.Router();
const common = require('../common');
const logger = require('../logger');

router.post('/', async (req, res, next) => {
  const _id = req.body._id || '';

  if(_id !== '') {
    common.userSems[uid].take(async () => {
      try {
        const termInfos = await common.getTerms(
          req.session.uid,
          [new mongo.ObjectId(_id)],
        );
        return res.json({result: true, termInfo: termInfos[0]});
      } catch(err) {
        logger.error(err.stack);
        return res.json({result: false, msg: err.message});
      } finally {
        common.userSems[uid].leave();
      }
    });
  } else {
    return res.json({result: false, msg: 'invalid id'});
  }
});

module.exports = router;
