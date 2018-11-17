import React from 'react';
import './App.css';
import core from './core';
import Loading from './pages/Loading';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Study from './pages/Study';
import Main from './pages/Main';
import MainNotification from './components/MainNotification';
import querystring from 'querystring';
import red from '@material-ui/core/colors/red';
import Icon from '@mdi/react'
import { mdiCancel } from '@mdi/js'

window.__MUI_USE_NEXT_TYPOGRAPHY_VARIANTS__ = true;

class App extends React.Component {
  state = {
    curPage: 'loading',
    err: '',
    curUser: '',
  };
  stack = [];
  curIndices = [];
  questionTypes = [];

  constructor(props) {
    super(props);
    core.init();
    core.setFunction('changePage', this.changePage);
  }
  
  componentDidMount() {
    const href = new URL(window.location.href);
    this.search = querystring.parse(href.search.substring(1, href.search.length));

    core.getCurrentUser().then(data => {
      if(data.result) {
        //-- signed in --//
        // register token(silent success)
        core.registerToken().catch(err => {
          core.showMainNotification('Notification is blocked. You cannot receive the alarm.', 'info', 0);
        });

        // find proper page
        if(this.search.action === 'practice' || this.search.action === 'test') {
          new Promise(() => {
            // fetch stack
            const stackIdNew = this.search.stackId;
            let stack = localStorage.getItem('stack');
            let stackId = localStorage.getItem('stackId');
            let prom;
            if(!stack || stackId !== stackIdNew) {
              // get the new stack
              stackId = stackIdNew;
              prom = core.getStack(stackId)
              .then(data => {
                if(data.result) {
                  stack = data.stack;
                  localStorage.setItem('stack', JSON.stringify(stack));
                  localStorage.setItem('stackId', stackId);
                } else {
                  throw Error('Could not get the list');
                }
              });
            } else {
              // old one - check validity
              prom = new Promise((resolve, reject) => {
                if(stackId === data.stackId) {
                  stack = JSON.parse(stack);
                  resolve();
                } else {
                  throw Error('Invalid list');
                }
              });
            }
    
            return prom.then(() => {
              this.stack = stack;
              if(this.search.action === 'practice') {
                this.curIndices = JSON.parse(this.search.curIndices);
                // this.setState({curPage: 'practice'});
                this.changePage('practice');
              } else {
                let i;
                this.questionTypes=[];
                for(i=0;i<stack.length;i++)
                  this.questionTypes.push(Math.floor((Math.random()*2) % 2));
                // this.setState({curPage: 'test'});
                this.changePage('test');
              }
            }).catch(err => {
              this.displayError(err);
            });
          });
        } else {
          this.changePage('main');
        }
      } else {
        //-- not signed in --//
        this.changePage('signin');
      }
    }).catch(err => {
      this.displayError(err);
    });
  }

  displayError(msg) {
    console.error(msg);
    if(typeof msg === 'object')
      msg = msg.toString();
    this.setState({
      curPage: 'error',
      err: msg || '',
    });
  }

  changePage = (page) => this.setState({curPage: page})
  render() {
    let content;

    if(this.state.curPage === 'loading') {
      content = <Loading onRef={ref => {this.loading = ref}} />;
    } else if(this.state.curPage === 'practice') {
      if(this.stack && this.curIndices)
        content = <Study
                    action='practice'
                    stack={this.stack}
                    curIndices={this.curIndices}
                  />;
      else
        this.setState({curPage: 'error', err: 'Unknown page'});
    } else if(this.state.curPage === 'test') {
      content = <Study
                  action='test'
                  stack={this.stack}
                  questionTypes={this.questionTypes}
                />;
    } else if(this.state.curPage === 'main') {
      content = <Main />;
    } else if(this.state.curPage === 'signin') {
      content = <SignIn />;
    } else if(this.state.curPage === 'signup') {
      content = <SignUp />;
    } else if(this.state.curPage === 'error') {
      content = (
        <div>
          <Icon path={mdiCancel} size='20vw' color={red[500]} /><br />
          {this.state.err}
        </div>
      );
    }

    return (
      <div className="App">
        <MainNotification
          onRef={ref => core.setFunction('showMainNotification', ref.add)}
        />
        {content}
      </div>
    );
  }
}

export default App;
