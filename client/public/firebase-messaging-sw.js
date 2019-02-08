importScripts('lib/loader.js');

function init() {
  // DB
  mydb.open();
}

// remember termInfos come from the server
// termInfos may have different structure from that in the client
async function handleSetTermSync(termInfos) {
  const {tx, terms, others, syncs} = await mydb.getObjectStores(
    ['terms', 'others', 'syncs'], 'readwrite'
  );

  try {
    // Put. This includes correcting temp _id.
    await mydb.putIfNew(conf.timestampFields.terms, termInfos, terms, others);
  
    // clean up sync
    // Do with _id and tmpId because of no idea whether _id is a temp or not
    await mydb.delIfOld(conf.timestampFields.sync, termInfos, syncs, others);
    for(let termInfo of termInfos) termInfo._id = termInfo.tmpId;
    await mydb.delIfOld(conf.timestampFields.sync, termInfos, syncs, others);
  } catch(err) {
    tx.abort();
    throw err;
  }
}

// remember termInfos come from the server 
// termInfos may have different structure from that in the client
async function handleDelTermSync(termInfos) {  
  const {tx, others, terms, syncs} = await mydb.getObjectStores(
    ['others', 'terms', 'syncs'], 'readwrite'
  );

  try {
    // delete term
    await mydb.delIfOld(
      conf.timestampFields.terms,
      termInfos,
      terms,
      others,
    )

    // clean up sync
    await mydb.delIfOld(
      conf.timestampFields.sync,
      termInfos,
      syncs,
      others,
    )
  } catch(err) {
    console.error('aborting:', err);
    tx.abort();
    throw err;
  }
}

async function handleSettingsSync(settingsInfo) {
  const {tx, others, syncs} = await mydb.getObjectStores(
    ['others', 'syncs'], 'readwrite'
  );

  try {
    // set settings
    await mydb.putIfNew(conf.timestampFields.settings, settingsInfo, others, others);

    // clean up sync
    await mydb.delIfOld(conf.timestampFields.sync, settingsInfo, syncs, others);
  } catch(err) {
    console.error('aborting:', err);
    tx.abort();
    throw err;
  }
}

async function handleApplyTestResults(testResInfo) {
  if(testResInfo.result) {
    const {tx, others, syncs} = await mydb.getObjectStores(
      ['others', 'syncs'], 'readwrite'
    );
  
    try {
      const stackInfo = {_id: testResInfo.stackId, timestamp: testResInfo.timestamp};

      // clean up stack
      await mydb.delIfOld(conf.timestampFields.stack, stackInfo, others, others);

      // clean up sync
      await mydb.delIfOld(conf.timestampFields.sync, stackInfo, syncs, others);
    } catch(err) {
      console.error('aborting:', err);
      tx.abort();
      throw err;
    }
  } else {
    console.error('Applying test results failed:', testResInfo.msg);
  }
}

async function handleCloseAccount(userInfo) {
  const {others} = await mydb.getObjectStores('others');
  const settingsInfo = await others.get('settings');

  if(userInfo.email === settingsInfo.email) {
    // client
    await mydb.initDB(true);
  }
}

// self.addEventListener('message', function (event) {
//   console.log("SW Received Message: " + event.data);  
// });   

// Listen for incoming push notifications   
self.addEventListener('push', event => {
  const {data} = event.data.json() || {};
  const image = data.image || '/images/icons/icon-72x72.png';
  const title = data.title || 'Annoyer';

  // Notification options
  const options = {
    body: '',
    icon: image,
    badge: image,
    data: {
      url: '/',
    },
    requireInteraction: true,
  };

  if(data.notiType === conf.notiTypes.practice) {
    options.body = 'Bump yourself up!';
    options.data.url = '/?action=practice&stackId=' + data.stackId + '&curIndices=' + data.curIndices;
  } else if(data.notiType === conf.notiTypes.test) {
    options.body = 'End of the day!';
    options.data.url = '/?action=test&stackId=' + data.stackId;
  } else if(data.notiType === conf.notiTypes.announcement) {
    options.body = data.msg;
  } else if(data.notiType === conf.notiTypes.sync) {
    if(data.type === conf.syncTypes.setTerm) {
      handleSetTermSync(JSON.parse(data.syncInfos));
    } else if(data.type === conf.syncTypes.delTerm) {
      handleDelTermSync(JSON.parse(data.syncInfos));
    } else if(data.type === conf.syncTypes.stack) {
      console.error('There\'s no stack sync!');
    } else if(data.type === conf.syncTypes.setSettings) {
      handleSettingsSync(JSON.parse(data.syncInfos));
    } else if(data.type === conf.syncTypes.applyTestResults) {
      handleApplyTestResults(JSON.parse(data.syncInfos));
    } else if(data.type === conf.syncTypes.closeAccount) {
    }
    return;
  }

  // Wait until notification is shown
  event.waitUntil(self.registration.showNotification(title, options));
});

// Listen for notification click event
self.addEventListener('notificationclick', event => {
  // Hide notification
  event.notification.close();

  // Attempt to extract notification URL
  const url = event.notification.data.url;

  // Check if it exists
  if (url) {
    // Open the target URL in a new tab/window
    event.waitUntil(clients.openWindow(url));
  }
});

init();