## to do
- remove sessions on changing password
- offline usage, background sync
  - https://developers.google.com/web/updates/2015/12/background-sync
- refresh term list fired by another client's update
- update stack when modify a term in the stack
- unified error handling
- blankify error
  - term: enough is enough
  - ex: I've heard all the complaining from you that I can take. Enough is enough.
  - blankified: I've heard all the complaining from you that I can take. Enough is ___
  - term: set in stone
  - ex: Keep in mind that these blueprints are not set in stone—they're just to give you a feel for the design.
  - blankified: Keep in mind that these blueprints are not ___ ___ stone—they're just to give you a feel for the design.
- send only one test msg 
- mixing the order of term, def, ex on practice
- key bindings for answer, mnemonic, 'correct', 'wrong' buttons in test
- shuffling the cards on test
- remove scheduler on deleting app
- confirmation dialog if doPractice is set on signout
- Term grouping in TermList like in Kakaotalk
- display 'working...' when
  adding a term,
  viewing a term,
  modifying a term,
  backup,
  just everything that access DB...
- per device notification switch(on/off)
- length limit on term, def, ex, etc...
- audio upload(or use youtube clip without down/uploading?)
- get input from user when testing for a single word(considering the variants of the word)
- search, filter termlist
- (new menu) statistics: graph of term levels
- (new menu) history: user's behavior is whether deligent or lazy
- a bunch of notification on lazy learning
- On blankified problem, show optional definition as a hint
- transaction on server-side
- replace loading page with MainNotification
- Study.js: move codes in render() to componentDidMount()
- https://material-ui.com/style/typography#migration-to-typography-v2
- clean up sessions after closing account
- refreshTermList() in TermList takes linear time. Better way?
- make study working for non-chrome browser

## docs
- MongoDB Node.js Driver
  - http://mongodb.github.io/node-mongodb-native/3.1/
- Material Design Icons
  - https://materialdesignicons.com/
- React-virtualized
  - https://github.com/bvaughn/react-virtualized
- Web App Manifest Generator(including Icons)
  - https://app-manifest.firebaseapp.com/
- IndexedDB Promised
  - https://github.com/jakearchibald/idb

## study system
- notification
	- total time : L
	- \# of terms a day : n
	- \# of repetitions per term : m
	- \# of terms per a notification : k
	- notification interval : T = L / ceil(mn/k)
	- L = 8 hr, n = 16, m = k = 3	=>	T = 0.5 hr
	- these values must be written on server side
- Term types
  - definition, meaning
  - definition, autio clip(maybe later)
- Question types
  - ask term given the blankified sentence
  - ask definition given the term
  - ask sentence given the audio(maybe later)
- Level management
  - Each term has a level.
  - if both def, ex are correct, then level up
  - if either def or ex is incorrect, then level down.
- Building daily stack
	- DB maintains the # of terms in each level.
    - Given # of terms: n_i     where i is level, i = 1, 2, ... , k
	  - let a_i = n_i / i     for i=1, ... ,k
    - let b_i = a_1+...+a_i  for i=1, ... ,k
	  - Pick n random numbers between 0 and b_k, and put it into proper section partitioned by {0, b1, ..., b_k}.
    - If more than n_i numbers are fallen into i th bucket, pick another random numbers.


## synchronization
- Timestamp is maintained as a version of each term, settings, and stack.
- Checkum for terms is liable for integrity of term list.
- Due to lack of timer on client in PWA, offline study is infeasible. Yet, you can add, edit, delete terms, and edit settings.