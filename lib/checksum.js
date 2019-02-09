try {
  var crypto = require('crypto');
  var md5 = _id => crypto.createHash('md5').update(_id).digest('hex');
} catch(err) {}

var cs = {
  // initial checksum
  // must be changed if you modify checksum algorithm
  initChecksum: '00000000000000000000000000000000',    // md5 len === 128 bits
};

// mongoDB objectIDs -> checksums
// ids: (array) or (string)
cs.getChecksums = ids => {
  // single id
  if(typeof ids === 'string') {
    if(typeof ids !== 'string') {
      ids = ids.toHexString();
    }
    return md5(ids);
  }

  // array of ids
  let checksums = [];
  for(let _id of ids) {
    if(typeof _id !== 'string') {
      _id = _id.toHexString();
    }
    checksums.push(md5(_id));
  }
  return checksums;
};

cs.addChecksum = (checksum1, checksum2) => {
  // md5 is 16 bytes(32 chars) length.
  // Javascript uses signed 32-bits int during bitwise operation.
  // To prevent each chunk has negative value, we process 2 bytes(4 chars) at a time.
  const step = 4;

  // Return array of integers
  function decompose(checksum) {
    let i, retval = [];
    for(i=0;i<checksum.length;i+=step) {
      retval.push(parseInt(checksum.substr(i, step), 16));
    }
    return retval;
  }

  // accumulate
  const csDecom1 = decompose(checksum1), csDecom2 = decompose(checksum2);
  let resultDecom = [];
  for(let i=0;i<csDecom1.length;i++) {
    resultDecom.push(csDecom1[i] ^ csDecom2[i]);
  }

  // compose
  let result = '';
  for(const chunk of resultDecom) {
    result += chunk.toString(16).padStart(step, '0');
  };
  
  return result;
};

// addition and subtraction are interchangeable in XOR
cs.subChecksum = cs.addChecksum;

try {
  module.exports = cs;
} catch(err){}