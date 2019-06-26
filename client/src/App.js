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
    core.setFunction('changePage', this.changePage);
    core.setFunction('getCurPage', this.getCurPage);
  }
  
  componentDidMount = async () => {
    const href = new URL(window.location.href);
    this.search = querystring.parse(href.search.substring(1, href.search.length));

    await core.init();

    if(await core.checkLogin()) {
      //-- signed in --//
      // initial sync check
      core.checkSync();
      core.sync();

      // find proper page
      if(this.search.action === 'practice' || this.search.action === 'test') {
        // fetch stack
        const stackInfo = await core.getStack(this.search.stackId);
        if(stackInfo) {
          const stack = stackInfo.stack;
          this.stack = stack;
          this.stackId = stackInfo._id;
          if(this.search.action === 'practice') {
            this.curIndices = JSON.parse(this.search.curIndices);
            // this.setState({curPage: 'practice'});
            this.changePage('practice');
          } else {
            this.questionTypes = [];
            let i=0;
            for(;i<stack.length;i++) {
              this.questionTypes.push(Math.floor((Math.random()*2) % 2)); // 0 or 1, evenly
            }
            // this.setState({curPage: 'test'});
            this.changePage('test');
          }
        }
      } else {
        this.changePage('main');
      }
    } else {
      //-- not signed in --//
      this.changePage('signin');
    }
  }

  displayError = msg => {
    console.error(msg);
    if(typeof msg === 'object')
      msg = msg.toString();
    this.setState({
      curPage: 'error',
      err: msg || '',
    });
  }

  changePage = page => this.setState({curPage: page})
  getCurPage = () => this.state.curPage
  render = () => {
    let content;

    if(this.state.curPage === 'loading') {
      content = <Loading onRef={ref => {this.loading = ref}} />;
    } else if(this.state.curPage === 'practice') {
      if(this.stack && this.curIndices) {
        content = <Study
                    action='practice'
                    stack={this.stack}
                    curIndices={this.curIndices}
                  />;
      } else {
        this.setState({curPage: 'error', err: 'Unknown page'});
      }
    } else if(this.state.curPage === 'test') {
      content = <Study
                  action='test'
                  stackId={this.stackId}
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
