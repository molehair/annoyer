import firebase from "firebase/app";
import 'firebase/firebase-messaging';
import packageJson from '../package.json';

var exports = {
  isTokenRegistered: false,

  init: () => {
    if(packageJson.serverAddress[packageJson.serverAddress.length-1] === '/')
      exports.serverAddress = packageJson.serverAddress.substr(0, packageJson.serverAddress.length-1);
    else
      exports.serverAddress = packageJson.serverAddress;

    // Firebase
    firebase.initializeApp({
      messagingSenderId: packageJson.firebaseMessagingSenderId,
    });

    // FCM
    if(firebase.messaging.isSupported()) {
      exports.messaging = firebase.messaging();
      exports.messaging.usePublicVapidKey(packageJson.firebaseWebPushKeyPublic);
      exports.messaging.onTokenRefresh(() => this.getToken());
    } else {
      exports.messaging = null;
    }
  },

  setFunction: (funcName, func) => {exports[funcName] = func},

  getCurrentUser: () => {
    return fetch(exports.serverAddress + '/getCurrentUser', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    }).then(res => {
      return (res.ok) ? res.json() : {result: false};
    });
  },

  getToken: () => {
    // Get Instance ID token. Initially this makes a network call, once retrieved
    // subsequent calls to getToken will return from cache.
    return exports.messaging.getToken().then(token => {
      if(token) {
        return fetch(exports.serverAddress + '/setToken', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({token}),
        }).then(res => {
          return (res.ok) ? res.json() : {result: false};
        }).then(data => {
          if(data.result) {
            exports.isTokenRegistered = true;
            return true;
          } else {
            throw data.msg || 'Annoyer server error';
          }
        }).catch(err => {
          // core.showMainNotification('Notification is blocked. You cannot receive the alarm.', 'info', 0);
          console.error(err);
          throw err;
        });
      } else {
        console.error('No Instance ID token available. Request permission to generate one.');
      }
    }).catch(err => {
      console.error('An error occurred while retrieving token. ', err);
    });
  },

  // register to both Pushy and Annoyer server
  registerToken: () => {
    // already registered?
    if(exports.isTokenRegistered) {
      return new Promise((resolve, reject) => {return resolve()});
    }

    // not supported?
    if(!exports.messaging)
      throw 'Messaging is not supported.';

    // do
    return exports.messaging.requestPermission().then(() => {
      console.log('Notification permission granted.');
      exports.getToken();
    }).catch(err => {
      console.error('Unable to get permission to notify.', err);
    });
  },

  closeAccount: () => {
    return fetch(exports.serverAddress + '/closeAccount', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    }).then(res => {
      exports.isTokenRegistered = false;
      return (res.ok) ? res.json() : {result: false};
    });
  },

  getTerm: (_id) => {
    return fetch(exports.serverAddress + '/getTerm', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({_id: _id}),
    }).then(res => {
      return (res.ok) ? res.json() : {result: false};
    }).then(data => {
      return (data.result) ? data.term : null;
    });
  },

  getTermList: () => {
    return fetch(exports.serverAddress + '/getTermList', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({sortBy: 'term'}),
    }).then(res => {
      return (res.ok) ? res.json() : {result: false};
    });
  },

  setTerm: (term, isModifying) => {
    return fetch(exports.serverAddress + '/setTerm', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({term, isModifying}),
    }).then(res => {
      return (res.ok) ? res.json() : {result: false};
    });
  },

  delTerms: (termIDs) => {
    return fetch(exports.serverAddress + '/delTerms', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({termIDs: termIDs}),
    }).then(res => {
      return (res.ok) ? res.json() : {result: false};
    });
  },

  getStack: (stackId) => {
    return fetch(exports.serverAddress + '/getStack', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({stackId: stackId})
    }).then(res => {
      return (res.ok) ? res.json() : {result: false};
    });
  },

  getSettings: () => {
    return fetch(exports.serverAddress + '/getSettings', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    }).then(res => {
      return (res.ok) ? res.json() : {result: false};
    });
  },

  setSettings: (settings) => {
    return fetch(exports.serverAddress + '/setSettings', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    }).then((res) => {
      return (res.ok) ? res.json() : {result: false};
    });
  },

  login: (email, password) => {
    return fetch(exports.serverAddress + '/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({email, password}),
    }).then(res => {
      return (res.ok) ? res.json() : {result: false};
    });
  },

  register: (email, password, passwordRepeat) => {
    return fetch(exports.serverAddress + '/register', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({email, password, passwordRepeat}),
    }).then(res => {
      return (res.ok) ? res.json() : {result: false};
    });
  },

  logout: () => {
    return fetch(exports.serverAddress + '/logout', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    }).then(res => {
      exports.isTokenRegistered = false;
      return (res.ok) ? res.json() : {result: false};
    });
  },

  applyTestResults: (testResults) => {
    return fetch(exports.serverAddress + '/applyTestResult', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({testResults: testResults}),
    }).then(res => {
      return (res.ok) ? res.json() : {result: false};
    });
  },

  restore: (csvFile) => {
    const formData = new FormData();
    formData.append('file', csvFile);

    return fetch(exports.serverAddress + '/restore', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }).then(res => {
      return (res.ok) ? res.json() : {result: false};
    });
  },

  backup: () => {
    return fetch(exports.serverAddress + '/backup', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'text/csv',
        'Content-Type': 'application/json',
      },
    }).then(res => {
      return (res.ok) ? res.text() : '';
    });
  },

  // input: term, ex
  // output: blankified ex which
  //    1. maximizes the # of matched word chunks
  //    2. minimizes the distance between the end and the begin of blankified word
  //
  // strategy
  // * split term and ex into words, respectively, and then plot them into a plane.
  // * the coordinates are the index in the each list
  // * Note that a word doesn't necessarily correspond to one y coodinate
  //   as a word may be used more than once. ex: as well as
  // * x-axis is words of ex, and y-axis is words of term
  // * the correct answer is a set of points whose y coordinates are strictly increasing
  //   when sorted by x coordinates in ascending order.
  // * we start scanning ㅈ적기 귀ㅏㄴㅎ.ㅇ..ㄴ
  blankify: (term, ex) => {
    const BLANK = '___';

    // sentence => list of words
    function parseSentence(sentence, needVariants) {
      function isWord(c) {
        const code = c.charCodeAt(0);
        return (0x41 <= code && code <= 0x5A) || (0x61 <= code && code <= 0x7A) || 0x80 <= code;
      }
      let i, word = '';
      sentence += '.';    // sentinel for getting last word
      let coordinate = [];
      for(i=0;i<sentence.length;i++) {
        if(isWord(sentence[i])) {
          word += sentence[i];
        } else if(word !== '') {
          // found a word
          let coord = {idx: i-word.length, word};
          if(needVariants) {
            let l = [];   // list of variants of word
            if(word.endsWith('y')) {
              // study => I studied.
              l.push(word.substring(0, word.length-1)+'ies');
            } else if(word.endsWith('sis')) {
              // basis => Composing bases.
              l.push(word.substring(0, word.length-2)+'es');
            } else if(word.endsWith('e')) {
              // take => He is taking it away.
              l.push(word.substring(0, word.length-1)+'ing');
            }
            l.push(word + word[word.length-1] + 'ed');
            l.push(word + 'ed');
            l.push(word + word[word.length-1] + 'ing');   // shop => I was shopping.
            l.push(word + 'ing');
            l.push(word + 's');       // say => He says blah.
            l.push(word + 'd');       // ace => You aced the course.
            l.push(word);      // original one should be compared lastly
            coord.variants = l;
          }
          coordinate.push(coord);
          word = '';
        }
      }
      return coordinate;
    };

    // check if there is a point in (y1 < y < y2) among the left points
    function isPointExistsBetween(y1, y2) {
      let i;
      for(i=y1+1;i<y2;i++) {
        if(pointCounter[i] > 0)
          return false;
      }
      return true;
    };

    // return if the left point is better than the right one
    function isLeftBetter(left, right) {
      if(left.cnt > right.cnt)
        return true;
      else if(left.cnt < right.cnt)
        return false;
      else if(left.startX > right.startX)
        return true;
      else
        return false;
    };

    let pointId = 0;
    function point(x, y, cnt, startX, prevId) {
      return {pointId: pointId++, x, y, cnt, startX, prevId};
    };
    
    let i, j;

    // setup
    const X = parseSentence(ex.toLowerCase(), false);
    const Y = parseSentence(term.toLowerCase(), true);
    let wordToY = {};
    let pointCounter = [...Array(Y.length)].fill(0);    // per y coordinate
    for(i=0;i<Y.length;i++) {
      let variant;
      for(variant of Y[i].variants) {
        // wordToY
        if(wordToY[variant])
          wordToY[variant].push(i);
        else
          wordToY[variant] = [i];
      }

      // pointCounter
      pointCounter[i]++;
    }

    // get the answer
    let candidates = {};    // {pointId: point}, points that will be connected to future point
    let gOptimum = point(-1, -1, 0, -1, -1);  // the pointId of the end of final blank list
    let finishedPoints = {};   // {pointId: point}, points whose optimum of each is acquired
    finishedPoints[-1] = point(-1, -1, 0, -1, -1);   // sentinel
    for(i=0;i<X.length;i++) {
      let word = X[i].word, toDel = {};
      if(wordToY[word]) {   // check if word need to be check for being blankified
        for(j of wordToY[word]) {
          // pick up optimum among candidates
          let optimum = point(-1, -1, 0, -1, -1), pId;
          for(pId in candidates) {
            let candidate = candidates[pId];
            if(candidate.y < j && isLeftBetter(candidate, optimum)) {
              // found better optimum
              optimum = candidate;
              if(!isPointExistsBetween(candidate.y, j))
                toDel[candidate.pointId] = true;
            }
          }
    
          // picked optimum + current word
          let combined = point(
            i, j, optimum.cnt+1,
            (optimum.cnt > 0) ? optimum.startX : i,
            (optimum.cnt > 0) ? optimum.pointId : -1);
          candidates[combined.pointId] = combined;
          finishedPoints[combined.pointId] = combined;
          pointCounter[j]--;
    
          // update global optimum
          if(isLeftBetter(combined, gOptimum))
            gOptimum = combined;
        }
        for(j in toDel)
          delete candidates[j];
      }
    }

    // generate blankified ex
    let p = gOptimum, idx, l;
    let blankifiedEx = ex;
    while(p.cnt > 0) {
      idx = X[p.x].idx;
      l = X[p.x].word.length;
      blankifiedEx = blankifiedEx.substring(0, idx) + BLANK + blankifiedEx.substring(idx+l);
      p = finishedPoints[p.prevId];
    }

    return blankifiedEx;
  },

  isObjectEmpty: (obj) => {
    for(const _ in obj)
      return false;
    return true;
  },
}

export default exports;