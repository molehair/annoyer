## to do
- blankify error
  - term: enough is enough
  - ex: I've heard all the complaining from you that I can take. Enough is enough.
  - blankified: I've heard all the complaining from you that I can take. Enough is ___
- make server persistent over restart?
- key bindings for answer, mnemonic, 'correct', 'wrong' buttons in test
- save practice status in DB so that it can continued after update
- shuffling the cards on test
- hide "add new term" after doing one on the test
- remove scheduler on logout / deleting app
- confirmation dialog if doPractice is set on signout
- update stack when modify a term in the stack
- save term list and settings in the local storage, syncing them background
- ListSubheader in TermList, navigator bar like Kakaotalk
- offline usage, background sync => this will contribute performance also
- display 'working...' when
  adding a term,
  viewing a term,
  modifying a term,
  backup,
  just everything that access DB...
- per device notification switch(on/off)
- audio upload(or use youtube clip without down/uploading?)
- get input from user when testing for a single word(considering the variants of the word)
- search, filter termlist
- (new menu) statistics: graph of term levels
- (new menu) history: user's behavior is whether deligent or lazy
- a bunch of notification on lazy learning
- On blankified problem, show optional definition as a hint
- https://material-ui.com/style/typography#migration-to-typography-v2

## docs
- MongoDB Node.js Driver
  - http://mongodb.github.io/node-mongodb-native/3.1/
- Material Design Icons
  - https://materialdesignicons.com/
- React-virtualized
  - https://github.com/bvaughn/react-virtualized
- Web App Manifest Generator(including Icons)
  - https://app-manifest.firebaseapp.com/

## study system
- notification
	- total time : L
	- # of terms a day : n
	- # of repetitions per term : m
	- # of terms per a notification : k
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