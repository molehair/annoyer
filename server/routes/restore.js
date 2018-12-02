var express = require('express');
var router = express.Router();
const common = require('../common');
const fs = require('fs');
const formidable = require('formidable');
const csv = require("fast-csv");

const bulkSize = 10;

function bulkInsert(termList, uid) {
  return new Promise((resolve, reject) => {
    common.userSems[uid].take(() => {
      common.setTerms(termList, uid, false)
      .then(() => {
        common.userSems[uid].leave();
        resolve();
      });
    });
  });
}

router.post('/', function(req, res, next) {
  const form = new formidable.IncomingForm();
  form.parse(req);
  form.on('file', function (name, file) {
    let buf = [], promises = [];
    var fileStream = fs.createReadStream(file.path)
    .pipe(
      csv({headers: true})
      .on("data", doc => {
        doc.type = parseInt(doc.type);
        doc.level = (doc.level) ? parseInt(doc.level) : 1;
        buf.push(doc);
        if(buf.length >= bulkSize) {
          promises.push(bulkInsert(buf, req.session.uid));
          buf = [];
        }
      })
      .on("end", () => {
        if(buf.length) {
          promises.push(bulkInsert(buf, req.session.uid));
        }
        fileStream.destroy();
        return Promise.all(promises).then(() => res.json({result: true}));
      })
    );
  });
});

module.exports = router;
