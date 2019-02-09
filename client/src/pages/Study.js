import React from 'react';
import core from '../core';
import TermDialog from '../components/TermDialog';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import SwipeableViews from 'react-swipeable-views';
import { bindKeyboard } from 'react-swipeable-views-utils';
import Grid from '@material-ui/core/Grid';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import red from '@material-ui/core/colors/red';
import green from '@material-ui/core/colors/green';
import blue from '@material-ui/core/colors/blue';
import grey from '@material-ui/core/colors/grey';
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Icon from '@mdi/react'
import { mdiCheck, mdiClose, mdiSend, mdiDeleteEmpty } from '@mdi/js'
import mydb from '../lib/mydb';

const BindKeyboardSwipeableViews = bindKeyboard(SwipeableViews);

class AnswerPanel extends React.Component {
  render() {
    const {classes} = this.props;
    let data=[];
    if(this.props.mnemonic)
      data.push({summary: 'Mnemonic', content: this.props.mnemonic});
    data.push({summary: 'Answer', content: this.props.answer});
    return (
      <div className={classes.root}>
        {data.map(x => (
          <ExpansionPanel key={x.summary}>
            <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />}>
              <Typography className={classes.heading}>{x.summary}</Typography>
            </ExpansionPanelSummary>
            <ExpansionPanelDetails>
              <Typography>
                {x.content}
              </Typography>
            </ExpansionPanelDetails>
          </ExpansionPanel>
        ))}
      </div>
    );
  }
}

AnswerPanel.propTypes = {
  classes: PropTypes.object.isRequired,
};
const answerPanelStyles = theme => ({
  root: {
    width: '100%',
  },
  heading: {
    fontSize: theme.typography.pxToRem(15),
    fontWeight: theme.typography.fontWeightRegular,
  },
});
AnswerPanel = withStyles(answerPanelStyles)(AnswerPanel);

class StudyCard extends React.Component {
  state = {
    backgroundColor: '#FFF',
    testResult: {},
    type: '',
    showAddTermBtn: false,
  }
  removedGridItems = [
    <Grid item></Grid>,
    <Grid item>
      <CardContent>
        <Grid
          container
          direction='column'
          justify='center'
          alignItems='center'
        >
          <Grid item>
            <Icon path={mdiDeleteEmpty} size='20vw' color={grey[500]} />
          </Grid>
          <Grid item>
            <Typography gutterBottom style={{fontSize: '10vw'}}>
              Removed
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Grid>,
    <Grid item>
      <CardContent>
        <Typography color="textSecondary" gutterBottom>
          {this.props.index+1} / {this.props.totalLen}
        </Typography>
      </CardContent>
    </Grid>
  ]

  componentDidMount = async () => {
    let termInfo;
    if(this.props._id) {
      const {terms} = await mydb.getObjectStores('terms');
      termInfo = await terms.get(this.props._id);
    }
    this.setState({
      type: this.props.type,
      termInfo,
    });
  }

  handleAnswer = test => {
    let testResult = {};
    const target = (this.props.questionType === 0) ? 'defScoreChange' : 'exScoreChange';
    if(test === 'correct') {
      if(this.state.testResult[target] > 0) {
        // reset test result
        this.setState({testResult: {}, backgroundColor: '#FFF'});
      } else {
        // mark it correct
        testResult[target] = 1;
        this.setState({testResult: testResult, backgroundColor: green[300]});
      }
    } else if(test === 'wrong') {
      if(this.state.testResult[target] < 0) {
        // reset test result
        this.setState({testResult: {}, backgroundColor: '#FFF'});
      } else {
        // mark it wrong
        testResult[target] = -1;
        this.setState({testResult: testResult, backgroundColor: red[300]});
      }
    }    
    this.props.handleTestResult(this.state.termInfo._id, testResult);
  }

  handleSubmit = async () => {
    try {
      await this.props.applyTestResults();
      this.setState({type: 'done', showAddTermBtn: true});
    } catch(err) {
      console.error(err);
      core.showMainNotification('Failed to submit', 'error', 0);
    }
  }

  render() {
    const {classes} = this.props;
    let gridItems = [];

    if(this.state.type === 'practice') {
      // const termType = ['','default','audio clip'][this.state.termInfo.type];   // for future use
      if(this.state.termInfo) {
        gridItems.push(
          <Grid item style={{width:'100%'}}>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                {this.state.termInfo.term}
              </Typography>
              {[['Definition', this.state.termInfo.def], 
                ['Example', this.state.termInfo.ex],
                ['Mnemonic', this.state.termInfo.mnemonic],
                ].map(x => (
                  <div key={x[0]}>
                    <Typography variant="subtitle2" align='left' gutterBottom>
                      {x[0]}
                    </Typography>
                    <Typography
                      variant="body1"
                      align='left'
                      gutterBottom
                      paragraph
                      style={{paddingLeft: '2em'}}
                    >
                      {x[1]}
                    </Typography>
                  </div>
                ))}
            </CardContent>
          </Grid>
        );
        gridItems.push(
          <Grid item style={{width: '100%'}}>
            <CardContent>
              <Grid
                container
                direction="row"
                justify="center"
                alignItems="center"
              >
                <Grid item xs={4}>
                  <Typography color="textSecondary" gutterBottom>
                    {this.props.index+1} / {this.props.totalLen}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Grid>
        );
      } else {
        gridItems = this.removedGridItems;
      }
    } else if(this.state.type === 'done') {
      let addTermBtn = <div></div>;
      if(this.state.showAddTermBtn) {
        addTermBtn = (
          <Button onClick={() => this.props.addNewTerm()}>
            <Typography gutterBottom style={{fontSize: '5vw'}}>
              Add new term!
            </Typography>
          </Button>
        );
      }
      gridItems.push(<Grid item></Grid>);
      gridItems.push(
        <Grid item>
          <CardContent>
            <Icon path={mdiCheck} size='20vw' color={green[500]} />
            <Typography gutterBottom style={{fontSize: '10vw'}}>
              Well done
            </Typography>
            {addTermBtn}
          </CardContent>
        </Grid>
      );
      gridItems.push(<Grid item></Grid>);
    } else if(this.state.type === 'test') {
      const termInfo = this.state.termInfo;
      // const termType = ['','default','audio clip'][termInfo.type];      // for future use
      let question, problem, answer;
  
      if(termInfo) {
        if(this.props.questionType === 0) {
          //-- Ask definition --//
          question = 'What is the definition of the following term?';
          problem = termInfo.term;
          answer = termInfo.def;
        } else if(this.props.questionType === 1) {
          //-- Ask term --//
          question = 'Fill in the blanks in the following sentence.';
          problem = core.blankify(termInfo.term, termInfo.ex);
          answer = termInfo.term;
        }
    
        gridItems.push(
          <Grid item>
            <CardContent>
              <Typography variant="h6" align='left' gutterBottom>
                {question}
              </Typography>
            </CardContent>
          </Grid>
        );
        gridItems.push(
          <Grid item>
            <CardContent>
              <Typography variant="body1" gutterBottom>
                {problem}
              </Typography>
            </CardContent>
          </Grid>
        );
        gridItems.push(
          <Grid item>
            <CardContent>
              <AnswerPanel answer={answer} mnemonic={termInfo.mnemonic} />
            </CardContent>
          </Grid>
        );
        gridItems.push(
          <Grid item style={{width: '100%'}}>
            <CardContent>
              <Grid
                container
                direction="row"
                justify="space-between"
                alignItems="center"
              >
                <Grid item xs={4}>
                  <Button fullWidth onClick={() => this.handleAnswer('correct')}>
                    <Icon path={mdiCheck} size='3em' color={green[500]} />
                  </Button>
                </Grid>
                <Grid item xs={4}>
                  <Typography color="textSecondary" gutterBottom>
                    {this.props.index+1} / {this.props.totalLen}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Button fullWidth onClick={() => this.handleAnswer('wrong')}>
                    <Icon path={mdiClose} size='3em' color={red[500]} />
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Grid>
        );
      } else {
        gridItems = this.removedGridItems;
      }
    } else if(this.state.type === 'testSubmit') {
      gridItems.push(<Grid item></Grid>);
      gridItems.push(
        <Grid item>
          <CardContent>
            <Button onClick={this.handleSubmit}>
              <Grid
                container
                direction='column'
                justify='center'
                alignItems='center'
              >
                <Grid item>
                  <Icon path={mdiSend} size='20vw' color={blue[500]} />
                </Grid>
                <Grid item>
                  <Typography gutterBottom style={{fontSize: '10vw'}}>
                    Submit
                  </Typography>
                </Grid>
              </Grid>
            </Button>
          </CardContent>
        </Grid>
      );
      gridItems.push(<Grid item></Grid>);
    }

    return (
      <Card
        className={classes.card}
        raised={true}
        style={{
          backgroundColor: this.state.backgroundColor,
          minHeight: '80vh',
        }}
      >
        <Grid
          container
          direction='column'
          justify='space-between'
          alignItems='center'
          className={classes.gridContainer}
          style={{minHeight: '80vh'}}
        >
          {gridItems}
        </Grid>
      </Card>
    );
  }
}

StudyCard.propTypes = {
  classes: PropTypes.object.isRequired,
};

const studyCardStyles = {
  card: {
    height: '100%',
  },
  gridContainer: {
    height: '100%',
  }
};

StudyCard = withStyles(studyCardStyles)(StudyCard);

class Study extends React.Component {
  state = {
    index: 0,
  };
  testResults = {};

  componentDidMount = () => {
    const {classes, action, curIndices, stack, questionTypes} = this.props;
    let cards = [];

    // cards of terms
    if(action === 'practice') {
      cards = [...Array(curIndices.length).keys()].map(i => (
        <div
          className={classes.cardCover}
          onClick={() => this.handleChangeIndex(i)}
          key={i}
        >
          <StudyCard
            type={action}
            _id={stack[curIndices[i]]}
            index={i}
            totalLen={curIndices.length}
          />
        </div>
      ));
    } else {  // action === test
      cards = [...Array(stack.length).keys()].map(i => (
        <div
          className={classes.cardCover}
          onClick={() => this.handleChangeIndex(i)}
          key={i}
        >
          <StudyCard
            type={action}
            _id={stack[i]}
            index={i}
            totalLen={stack.length}
            questionType={questionTypes[i]}
            handleTestResult={(termID, testResult) => this.handleTestResult(termID, testResult)}
          />
        </div>
      ));
    }

    // card of end or submit
    const cardsLen = cards.length;
    cards.push(
      <div
        className={classes.cardCover}
        onClick={() => this.handleChangeIndex(cardsLen)}
        key={stack.length}
      >
        <StudyCard
          type={(action === 'practice') ? 'done' : 'testSubmit'}
          applyTestResults={() => core.applyTestResults(this.props.stackId, this.testResults)}
          addNewTerm={() => this.addNewTerm()}
        />
      </div>
    );

    this.setState({cards}); 
  }

  handleChangeIndex = index => this.setState({index})
  handleTestResult = (termID, testResult) => {this.testResults[termID] = testResult}
  addNewTerm = () => this.termDialog.addNewTerm()
  render = () => {
    if(this.state.cards) {
      return (
        <div>
          <BindKeyboardSwipeableViews
            style={{
              marginTop: 5,
              paddingLeft: '10vw',
              paddingRight: '10vw',
            }}
            index={this.state.index}
            onChangeIndex={this.handleChangeIndex}
          >
            {this.state.cards}
          </BindKeyboardSwipeableViews>
          <TermDialog
            onRef = {ref => {this.termDialog = ref}}
            setTermCallback = {() => core.showMainNotification('Added', 'success')}
          />
        </div>
      );
    } else {
      return <div></div>;
    }
  }
}
Study.propTypes = {
  classes: PropTypes.object.isRequired,
};

const studyStyles = {
  cardCover: {
    padding: 5,
  },
};

export default withStyles(studyStyles)(Study);