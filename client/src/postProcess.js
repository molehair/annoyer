const fs = require('fs');
const jsdom = require("jsdom");
const swPrecache = require('sw-precache');

const { JSDOM } = jsdom;

const serviceWorker = 'build/service-worker.js';
const firebaseMessagingSw = './firebase-messaging-sw.js';
const indexFile = 'build/index.html';

// custom service worker
swPrecache.write(serviceWorker, {
  staticFileGlobs: [
    './build/**/**.html',
    './build/images/**.*',
    './build/static/**',
  ],
  dontCacheBustUrlsMatching: /\.\w{8}\./,
  maximumFileSizeToCacheInBytes: 5*1024*1024,
  navigateFallback: './200.html',
  navigateFallbackWhitelist: [/^(?!\/__).*/],
  staticFileGlobsIgnorePatterns: [/\.map$/, /asset-manifest\.json$/],
  stripPrefix: './build',
  importScripts: ([firebaseMessagingSw]),
});
// fs.appendFile(
//   serviceWorker,
//   "importScripts('"+firebaseMessagingSw+"');",
//   function (err) {
//     if (err) throw err;
//     console.log('Added custom service worker.');
//   }
// );

// set deferred list
JSDOM.fromFile(indexFile).then(dom => {
  let document = dom.window.document;

  // elicit stylesheet urls
  let link, toDel=[], deferredList = [];
  for(link of document.getElementsByTagName('link')) {
    if(link.rel === 'stylesheet') {
      let url = link.href;
      if(url.startsWith('file:///')) {
        url = url.substring(7);         // cut out "file://"
      }
      deferredList.push(url);
      toDel.push(link);
    }
  }

  // remove links in header
  for(link of toDel) {
    link.parentNode.removeChild(link);
  }
  
  // set the url list
  document.getElementById('deferredLoaderURLs')
  .innerHTML='const deferredList='+JSON.stringify(deferredList)+';';

  // write back
  fs.writeFile(indexFile, dom.serialize(), function(err) {
    if(err) throw err;
  });

  console.log('Deferred loading is set.');
});