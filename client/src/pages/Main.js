import React from 'react';
import TermList from './TermList';
import Settings from './Settings';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import BottomNavigation from '@material-ui/core/BottomNavigation';
import BottomNavigationAction from '@material-ui/core/BottomNavigationAction';
import Icon from '@material-ui/core/Icon';

function TabContainer(props) {
  return (
    <Typography
      component="div"
      dir={props.dir}
      style={{ padding: 3 }}
    >
      {props.children}
    </Typography>
  );
}

TabContainer.propTypes = {
  children: PropTypes.node.isRequired,
};

const mainStyles = theme => ({
  bottomNavigation: {
    width: '100%',
    position: 'fixed',
    bottom: 0,
  },
  root: {
    backgroundColor: theme.palette.background.paper,
  },
});

class Main extends React.Component {
  state = {
    index: 0,
  };

  pageInfos = [
    {
      label: 'List',
      icon: <Icon>list</Icon>,
      pageName: 'termList',
      content: <TermList />,
    }, {
      label: 'Settings',
      icon: <Icon>settings</Icon>,
      pageName: 'settings',
      content: <Settings />,
    },
  ]

  handleIndexChange = (event, index) => this.setState({index})
  render() {
    const { classes } = this.props;

    const content = this.pageInfos[this.state.index].content;

    return (
      <div className={classes.root}>
        <div style={{paddingBottom: 56}}>
          {content}
        </div>
        <BottomNavigation
          value={this.state.index}
          onChange={this.handleIndexChange}
          className={classes.bottomNavigation}
        >
          {this.pageInfos.map((pageInfo, i) =>
            <BottomNavigationAction
              label={pageInfo.label}
              icon={pageInfo.icon}
              key={i}
            />
          )}
        </BottomNavigation>
      </div>
    );
  }
}

Main.propTypes = {
  classes: PropTypes.object.isRequired,
  // theme: PropTypes.object.isRequired,
};

export default withStyles(mainStyles)(Main);