const express = require('express');
const router = express.Router();
const common = require('../common');
const conf = require('../../lib/conf');
const logger = require('../logger');

router.post('/', function(req, res, next) {
  let termInfos = req.body.termInfos;
  const uid = req.session.uid;
  
  // reply with ACK
  res.json({result: true});

  if(termInfos) {
    common.userSems[uid].take(async () => {
      try {
        // set
        termInfos = await common.setTerms(uid, termInfos);  // get updated _ids

        // send result
        await common.sendSync(uid, conf.syncTypes.setTerm, termInfos);
      } catch(err) {
        logger.error(err.stack);
      } finally {
        common.userSems[uid].leave();
      }
    });
  }
});

module.exports = router;
