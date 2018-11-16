# Annoyer
Your annoying friend for learning vocabulary

## Features
  - Spaced learning
    - Given some words and idioms, Annoyer will show you them at every constant time(30 mins).
    - This is done for some hours(8 hours), daily.
  - Your own words or idioms
    - Annoyer doesn't provide any terms.
    - I believe crawling on your own is good for learning by heart.
  - Daily test
    - You should either sort out the definition of a term or fill in the blanks of the example sentence.
  - The Less you know, the more practice
    - The level system let you see terms you have trouble more frequently.
  - [PWA]

## Limitations
  - Self-checking
    - A user must score oneself on the test.
    - It is tricky for users to input words. It is even trickier for me to handle unarranged data. This is why I made it like this. Sorry!

## Self-deploy
> As this software aims to personal usage, **DEPLOYING FOR PUBLIC MAY BE NOT SAFE**. Use at your own risk.

#### Requirements
- [NodeJS][nodejs]
- Web server for client like [Apache], [Nginx]
- *https* domain
- Server to run an [express][express] app.
- MongoDB

> [Letsencrypt] is good way to get a certificate for *https*.
> Take a look at cloud service like [AWS], etc. if you don't have a server.
> Also, there's a cloud service for MongoDB [here][mongodb].

#### Deployment procedure
1. Set up [FCM][FCM].
1. Install client.
2. Run Server.

### FCM
For push notifications, Annoyer takes advantage of [FCM][FCM].
1. Go to [firebase console][firebaseConsole].
1. Create a new project.

### Client
Client is a [create-react-app][CRA] app. Open up `client/package.json` and fill in the following

- homepage
  - Client URI. Users connect to this address.
  - Make sure to use *https* for push notification.
  - ex) *https://myannoyer.com*
- serverAddress
  - Server URI.
  - *https* is recommended as your browser may block connecting *http* site from *https*.
  - ex) *https://myannoyer-server.com*
- firebaseMessagingSenderId
  - Go to `Project Setting` in the firebase console.
  - In `Cloud Messaging` tab, copy `Sender ID` and paste it.
  - ex) *111122223333*
- firebaseWebPushKeyPublic
  - Go to `Project Setting` in the firebase console.
  - In `Cloud Messaging` tab, go to `Web configuration` section and generate key pair.
  - Copy the created key pair and paste it.
  - ex) *BCv0nN4ofsFSs0iwB5s....rFuLKFjXk*

Next, build the static files. In the terminal
```bash
$ cd /path/to/client/
$ npm run build
```

Upon finished, you have `build/` directory. Place all files in `build/` in the root document of your web server. Make sure the web server has the permissions of the files.

### Server
Server is an [express][express] app. To config the server, set the environment variables. In *bash*,
```bash
$ export NODE_ENV="production"
$ export DB_NAME="annoyer"
$ export CLIENT_ADDRESS="<client URI>"
$ export MONGODB_ADDRESS="<mongoDB address>"
$ export FCM_SERVER_KEY="<server key>"
$ export FCM_SENDER_ID="<sender id>"
```
- client URI
  - the same as `homepage` in the client settings
- mongoDB address
  - If you run mongoDB on local, it's likely *mongodb://localhost:27017*
- server key
  - Go to `Project Setting` in the firebase console.
  - In `Cloud Messaging` tab, copy `Server key` and paste it.
  - ex) *ABADLmuDA7s:AKA92bfii...fMFR96*
- sender id
  - the same as `firebaseMessagingSenderId` in the client settings

Next, run the server.
```bash
$ cd /path/to/server/
$ npm run start
```
You can find log in `server/log`.

## Screenshots

### Main

<img src="/screenshots/termList.png" width=300>
<img src="/screenshots/setTerm.png" width=300>
<img src="/screenshots/settings.png" width=300>

### Practice

<img src="/screenshots/practice.png" width=300>

### Test

<img src="/screenshots/test1.png" width=300>
<img src="/screenshots/test2.png" width=300>

   [PWA]: <https://developers.google.com/web/progressive-web-apps/>
   [CRA]: <https://github.com/facebook/create-react-app>
   [nodejs]: <https://nodejs.org>
   [nodejsDownload]: <https://nodejs.org/en/download/>
   [FCM]: <https://firebase.google.com/docs/cloud-messaging/>
   [firebaseConsole]: <https://console.firebase.google.com>
   [express]: <https://expressjs.com/>
   [apache]: <https://www.apache.org/>
   [nginx]: <https://www.nginx.com/>
   [AWS]: <https://aws.amazon.com/>
   [mongodb]: <https://www.mongodb.com/download-center>
   [letsencrypt]: <https://letsencrypt.org/>