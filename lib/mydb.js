try {
  var idb = require('idb');
  var conf = require('./conf');
  var cs = require('./checksum');
} catch(err) {}


const dbName = "annoyer";
const dbVersion = 1;

var mydb = {};
var db;

mydb.open = async () => {
  // Even though idb version is 4, it works like 3. Weird.
  const dbInstance = await idb.openDb(dbName, dbVersion, upgradeDB => {
    db = upgradeDB;

    if(db.oldVersion === 0) {
      // object stores
      // The name 'tx' for object store is prohibited as getObjectStores use it.
      const terms = db.createObjectStore('terms', {keyPath: '_id'});
      const syncs = db.createObjectStore('syncs', {keyPath: '_id'});
      db.createObjectStore('others', {keyPath: 'category'});
    
      // indices
      terms.createIndex('tmpId', 'tmpId', {unique: true});
      terms.createIndex('term', 'term', {unique: false});
      terms.createIndex('timestamp', 'timestamp', {unique: false});
      syncs.createIndex('type', 'type', {unique: false});

      // update version
      db.oldVersion = 1;
    }
  });
  
  // set db instance
  db = dbInstance;

  // set default values
  mydb.initDB();
};

// Return {tx: transaction, <objStore1>, <objStore2>, ...}
// names: (string, array) names of objectStore.
// mode: 'readonly' or 'readwrite'
mydb.getObjectStores = async (names, mode='readonly') => {
  let retval = {};
  const transaction = db.transaction(names, mode);

  // get object stores
  if(typeof names === 'string') {
    retval[names] = transaction.objectStore(names);
  } else {
    for(const name of names) {
      retval[name] = transaction.objectStore(name);
    }
  }
  return retval;
};

// Put the given record if its timestamp is bigger than or equal to stored one
// If no timestamp is found in the stored record, it will put the new one.
// tsField: one of timestampFields
mydb.putIfNew = async (tsField, newRecord, targetObjStore, othersObjStore) => {
  if(tsField === conf.timestampFields.terms) {
    //-- terms --//
    // wrap single record
    const newTermInfos = arraify(newRecord);

    // look up
    let maxLastTS = 0;
    for(const newTermInfo of newTermInfos) {
      const oldTermInfo = await mydb.getRecordWithTermInfo(targetObjStore, newTermInfo);
      
      // replace tmpId with server-given one
      if(oldTermInfo && oldTermInfo._id.startsWith(conf.tmpIdPrefixes.term)) {
        await targetObjStore.delete(oldTermInfo._id);
      }

      // set term
      if(!oldTermInfo || oldTermInfo.timestamp <= newTermInfo.timestamp) {
        // put
        await targetObjStore.put(newTermInfo);

        // set maximum last timestamp
        maxLastTS = Math.max(maxLastTS, newTermInfo.timestamp);
      }

      // update checksum for adding only
      // Note that _id sent by server is not a temp.
      if((oldTermInfo && oldTermInfo._id.startsWith(conf.tmpIdPrefixes.term))
        || (!oldTermInfo && !newTermInfo._id.startsWith(conf.tmpIdPrefixes.term))) {
        let checksums = await othersObjStore.get('checksums');
        checksums.terms = cs.addChecksum(
          cs.getChecksums(newTermInfo._id), checksums.terms
        );
        await othersObjStore.put(checksums);
      }
    }

    // update last timestamp
    if(maxLastTS > 0) {
      let lastTS = {};
      lastTS[conf.timestampFields.terms] = maxLastTS;
      await mydb.updateLastTimestamp(othersObjStore, lastTS);
    }
  } else if(tsField === conf.timestampFields.settings) {
    //-- settings --//
    const newSettingsInfo = newRecord;
    let oldSettingsInfo = await othersObjStore.get('settings');
    
    if(!oldSettingsInfo
      || oldSettingsInfo.timestamp < newSettingsInfo.timestamp) {
      //-- need to override client one --//
      oldSettingsInfo = oldSettingsInfo || {};
      Object.assign(oldSettingsInfo, newSettingsInfo);
      await othersObjStore.put(oldSettingsInfo);

      // update last timestamp
      let lastTS = {};
      lastTS[conf.timestampFields.settings] = oldSettingsInfo.timestamp;
      return mydb.updateLastTimestamp(othersObjStore, lastTS);
    }
  } else if(tsField === conf.timestampFields.stack) {
    //-- stack --//
    const newStackInfo = newRecord;
    let oldStackInfo = await othersObjStore.get('stack');

    if(!oldStackInfo
      || oldStackInfo.timestamp < newStackInfo.timestamp) {
      //-- need to override client one --//
      oldStackInfo = oldStackInfo || {};
      Object.assign(oldStackInfo, newStackInfo);
      await othersObjStore.put(oldStackInfo);

      // update last timestamp
      let lastTS = {};
      lastTS[conf.timestampFields.stack] = oldStackInfo.timestamp;
      return mydb.updateLastTimestamp(othersObjStore, lastTS);
    }
  } else if(tsField === conf.timestampFields.sync) {
    //-- sync --//
    // wrap single record
    const newSyncInfos = arraify(newRecord);

    let proms = [];
    for(const newSyncInfo of newSyncInfos) {
      proms.push(targetObjStore.get(newSyncInfo[targetObjStore.keyPath])
      .then(oldRecord => {
        // Put record
        if(!oldRecord || !oldRecord.timestamp
          || oldRecord.timestamp < newSyncInfo.timestamp) {
          return targetObjStore.put(newSyncInfo);
        }
      }));
    }
    return Promise.all(proms);
  } else {
    console.error('new timestamp field?');
  }
};

// Delete the given record if its timestamp is bigger than or equal to stored one
// field: one of timestampFields
mydb.delIfOld = async (field, newRecord, targetObjStore, othersObjStore) => {
  if(field === conf.timestampFields.terms) {
    //-- terms --//
    // wrap single record
    const newTermInfos = arraify(newRecord);

    // Due to idb's transaction lifetime issue(https://www.npmjs.com/package/idb#transaction-lifetime)
    // and that updating checksum needs serial executions,
    // I've decided to delete terms one by one.
    let oldChecksums = await othersObjStore.get('checksums');
    let maxLastTS = 0;
    for(const newTermInfo of newTermInfos) {
      // find matching term in client DB
      const oldTermInfo = await mydb.getRecordWithTermInfo(targetObjStore, newTermInfo);
      
      // filter out "no matching term" case
      if(!oldTermInfo) continue;
  
      // Delete record
      // The equality must be hold as a confirmation from the server.
      if(oldTermInfo.timestamp <= newTermInfo.timestamp) {
        await targetObjStore.delete(oldTermInfo._id);

        // set maximum last timestamp
        maxLastTS = Math.max(maxLastTS, newTermInfo.timestamp);
      }
  
      // calculate checksum
      // only if new term has been accumulated into the checksum in client already
      if(!oldTermInfo._id.startsWith(conf.tmpIdPrefixes.term)) {
        oldChecksums.terms = cs.subChecksum(
          oldChecksums.terms, cs.getChecksums(oldTermInfo._id)
        );
      }
    }

    // update last timestamp
    let lastTS = {};
    lastTS[conf.timestampFields.terms] = maxLastTS;
    await mydb.updateLastTimestamp(othersObjStore, lastTS);
    
    // update checksum
    return othersObjStore.put(oldChecksums);
  } else if(field === conf.timestampFields.settings) {
    //-- settings --//
    console.log('implemelrmelf');
  } else if(field === conf.timestampFields.stack) {
    //-- stack --//
    const newStackInfo = newRecord;

    const oldStackInfo = await othersObjStore.get('stack');
    
    // Delete record
    if(oldStackInfo && oldStackInfo.timestamp <= newStackInfo.timestamp) {
      await othersObjStore.delete('stack');
    }
  } else if(field === conf.timestampFields.sync) {
    //-- sync --//
    // wrap single record
    const newSyncInfos = arraify(newRecord);

    // look up
    let proms = [];
    for(const newSyncInfo of newSyncInfos) {
      proms.push(new Promise(async (resolve, reject) => {
        const _id = newSyncInfo[targetObjStore.keyPath];
        if(_id) {
          const oldSyncInfo = await targetObjStore.get(_id);
          
          // Delete record
          if(oldSyncInfo && oldSyncInfo.timestamp <= newSyncInfo.timestamp) {
            await targetObjStore.delete(_id);
          }
        }

        resolve();
      }));
    }
    return Promise.all(proms);
  } else {
    console.error('new timestamp field?');
  }
};

// Find the record using
// 1. termInfo._id
// 2. termInfo.tmpId
mydb.getRecordWithTermInfo = async (objStore, termInfo) => {
  let proms = [
    objStore.get(termInfo._id),
    objStore.index('tmpId').get(termInfo._id),
  ];
  if(termInfo.tmpId) {
    proms.push(objStore.index('tmpId').get(termInfo.tmpId));
  }

  const results = await Promise.all(proms);
  for(let result of results) {
    if(result)  return result;
  }
};

// force: don't reset each table if this value is false
mydb.initDB = async (force=false) => {
  const {tx, terms, syncs, others} = await mydb.getObjectStores(
    ['terms', 'syncs', 'others'], 'readwrite'
  );
  try {
    // others
    if(force || await others.count() === 0) {
      await others.clear();
      
      // default values
      for(const category of Object.keys(conf.defaultValues)) {
        await others.put(Object.assign({},
          {category},
          conf.defaultValues[category],
        ));
      }

      // append timestamp onto settings
      await others.put(Object.assign({},
        {category: 'settings'},
        conf.defaultValues.settings,
        {timestamp: 0},
      ));
    }
    
    // etc.
    if(force) {
      await terms.clear();
      await syncs.clear();
    }
  } catch(err) {
    console.error(err);
    tx.abort();
    throw err;
  }
}

// others: ObjectStore of others. ObjectStore must not be created
//         in this function because updating last timestamps
//         needs to be done under the successive transaction.
mydb.updateLastTimestamp = async (others, newLastTimestamps) => {
  const oldLastTimestamps = await others.get('lastTimestamps');
  
  let lts;
  for(lts in newLastTimestamps) {
    if(!oldLastTimestamps[lts]
      || oldLastTimestamps[lts] < newLastTimestamps[lts]) {
      oldLastTimestamps[lts] = newLastTimestamps[lts];
    }
  }
  return others.put(oldLastTimestamps);
}

// Put an object in an array
// If the input is an array already, it gives back.
// obj: (array) or (object)
function arraify(obj) {
  return (obj.constructor === Array) ? obj : [obj]; 
}

export default mydb;
