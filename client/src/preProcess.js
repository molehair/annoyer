// const fs = require('fs');
// const packageJson = require('../package.json');

// // FCM
// let data = fs.readFileSync('src/firebase-messaging-sw.js', 'utf8');
// data = data.replace('[[firebaseMessagingSenderId]]', packageJson.firebaseMessagingSenderId);
// fs.writeFileSync('public/firebase-messaging-sw.js', data, 'utf8');
// console.log('Generated FCM service worker.');