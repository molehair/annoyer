try {
  var cs = require('./checksum');
} catch(err) {}

var conf = {
  // make sure key === value
  termTypes: {
    default: 'default',
    audioClip: 'audioClip',
  },
  
  // make sure key === value
  notiTypes: {
    practice: 'practice',
    test: 'test',
    announcement: 'announcement',
    sync: 'sync',
  },
  
  // make sure key === value
  syncTypes: {
    setTerm: 'setTerm',
    delTerm: 'delTerm',
    setStack: 'setStack',
    delStack: 'delStack',
    setSettings: 'setSettings',
    applyTestResults: 'applyTestResults',
    closeAccount: 'closeAccount',
  },

  // make sure key === value
  timestampFields: {
    terms: 'terms',
    settings: 'settings',
    stack: 'stack',
    sync: 'sync',
  },

  // temp Id prefixes such as when creating a term
  tmpIdPrefixes: {
    term: 'TERM',
  },

  importExportFields: [
    'type', 'term', 'def', 'ex', 'mnemonic', 'level',
  ],

  defaultValues: {
    settings: {
      alarmEnabled: false,
      alarmClock: 60,   // UTC 24-time, min
      enabledDays: [false, false, false, false, false, false, false],   // Sun, Mon, ..., Sat
    },
    checksums: {terms: cs.initChecksum},
    lastTimestamps: {
      terms: 0,
      settings: 0,
      stack: 0,
      testResults: 0,
    },
  },
};

try {
  module.exports = conf;
} catch(err) {}