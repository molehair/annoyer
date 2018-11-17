var express = require('express');
var router = express.Router();
const common = require('../common');


const Json2csvParser = require('json2csv').Parser;
const importExportProject = common.importExportFields.reduce(
  (acc, cur) => {acc[cur] = 1; return acc}, {_id: 0}
);

router.get('/', function(req, res, next) {
  const terms = common.db.collection('terms');

  return terms.find({uid: req.session.uid})
  .project(importExportProject).toArray()
  .then(docs => {
    const json2csvParser = new Json2csvParser({fields: common.importExportFields});
    const csv = json2csvParser.parse(docs);

    res.set('Content-Type', 'text/csv');
    return res.send(csv);
  });
});

module.exports = router;
