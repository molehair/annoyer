import React from 'react';
import core from '../core';
import TermDialog from '../components/TermDialog';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Fab from '@material-ui/core/Fab';
import Typography from '@material-ui/core/Typography';
import Checkbox from '@material-ui/core/Checkbox';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import DeleteIcon from '@material-ui/icons/Delete';
import FilterListIcon from '@material-ui/icons/FilterList';
import AddIcon from '@material-ui/icons/Add';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import red from '@material-ui/core/colors/red';
import { List, AutoSizer } from 'react-virtualized';


class SimpleTooltips extends React.Component {
  render() {
    const { classes } = this.props;
    return (
      <Tooltip title="Add new one">
        <Fab
          color="secondary"
          className={classes.absolute}
          onClick={() => this.props.addNewTerm() }
        >
          <AddIcon />
        </Fab>
      </Tooltip>
    );
  }
}

SimpleTooltips.propTypes = {
  classes: PropTypes.object.isRequired,
};
const tooltipStyles = theme => ({
  fab: {
    margin: theme.spacing.unit * 2,
  },
  absolute: {
    position: 'fixed',
    bottom: '15vh',
    right: '10vw',
  },
});
SimpleTooltips = withStyles(tooltipStyles)(SimpleTooltips);


class VirtualTermList extends React.Component {
  state = {
    termInfos: [],
    checked: {},
    checkedCount: 0,
  };
  perfectChecked = {}

  constructor(props) {
    super(props);
    this.props.onRef(this);
    core.setFunction('refreshTermList', this.refreshTermList);
  }

  componentDidMount = () => {
    this._isMounted = true;
    this.refreshTermList();
  }

  componentWillUnmount = () => {this._isMounted = false}
  
  refreshTermList = async () => {
    if(this._isMounted) {
      const termInfos = await core.getTermList();
  
      this.setState({termInfos});
  
      // build the case of all terms are checked
      // This is for all-check-button to work in a constant time.
      let perfectChecked = {};
      for(const termInfo of termInfos) {
        perfectChecked[termInfo._id] = true;
      };
      this.perfectChecked = perfectChecked;
    }
  }

  rowRenderer = ({
    key,         // Unique key within array of rows
    index,       // Index of row within collection
    isScrolling, // The List is currently being scrolled
    isVisible,   // This row is visible within the List (eg it is not an overscanned row)
    style        // Style object to be applied to row (to position it)
  }) => {
    const item = this.state.termInfos[index];

    if(!item)
      return (<div key={key} style={style}></div>)

    let style2 = Object.assign({}, style, {padding: 0});
    return (
      <ListItem
        key={key}
        role={undefined}
        // dense
        button
        tabIndex={-1}
        style={style2}
      >
        <Checkbox
          checked={item._id in this.state.checked}
          onClick={() => this.handleToggle(item._id)}
          // disableRipple
        />
        <ListItemText
          disableTypography
          primary={item.term}
          style={{
            alignItems: 'center',
            display:'flex',
            height:style.height,
          }}
          onClick={() => this.props.openTerm(item._id)}
        >
          <div style={{
            verticalAlign: 'middle',
          }}>
            {item.term}
          </div>
        </ListItemText>
      </ListItem>
    )
  }

  handleSelectAll = () => {
    let { checkedCount } = this.state;
    let checked = {};
    if(checkedCount === this.state.termInfos.length) {
      checkedCount = 0;
    } else {
      Object.assign(checked, this.perfectChecked);
      checkedCount = this.state.termInfos.length;
    }
    this.setState({checked, checkedCount});
  }

  handleToggle = _id => {
    let { checked, checkedCount } = this.state;

    if(_id in checked) {
      delete checked[_id];
      checkedCount--;
    } else {
      checked[_id] = true;
      checkedCount++;
    }
    this.setState({checked, checkedCount});
  };

  handleDelete = () => {
    return core.delTerms(Object.keys(this.state.checked))
    .then(() => {
      core.showMainNotification('Deleted', 'success');
      this.setState({checked: {}, checkedCount: 0});
      core.sync();
    });
  }

  render = () => {
    const {classes} = this.props;

    let title, titleColor, topRightIcon;
    if(this.state.checkedCount) {
      title = this.state.checkedCount + ' selected';
      titleColor = red[500];
      topRightIcon = (
        <Tooltip title="Delete" onClick={this.handleDelete}>
          <IconButton aria-label="Delete">
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      );
    } else {
      title = 'Total: ' + this.state.termInfos.length;
      titleColor = '#000';
      topRightIcon = (
        <Tooltip title="Filter list">
          <IconButton aria-label="Filter list">
            <FilterListIcon />
          </IconButton>
        </Tooltip>
      );
    }

    return (
      <div className={classes.root}>
        <AutoSizer>
          {({ height, width }) => (
            <List
              height={height}
              rowCount={this.state.termInfos.length}
              rowHeight={48}
              rowRenderer={this.rowRenderer}
              width={width}
              dummy={this.state}
            />
          )}
        </AutoSizer>
        <Grid
          container
          justify='space-between'
          alignItems='center'
          className={classes.header}
        >
          <Grid item>
            <Checkbox
              checked={this.state.checkedCount === this.state.termInfos.length}
              onClick={this.handleSelectAll}
              tabIndex={-1}
            />
          </Grid>
          <Grid item>
            <Typography variant='subtitle2' style={{color:titleColor}}>{title}</Typography>
          </Grid>
          <Grid item>
            {topRightIcon}
          </Grid>
        </Grid>
      </div>
    );
  }
}
VirtualTermList.propTypes = {
  classes: PropTypes.object.isRequired,
};
const virtualTermListStyles = theme => ({
  root: {
    width: '100%',
    backgroundColor: theme.palette.background.paper,
    paddingTop: 49,
    height: 'calc(100vh - 49px - 56px - 1px)',  // header, bottom navigation, padding
  },
  header: {
    position: 'fixed',
    top: 0,
    background: theme.palette.background.paper,
  }
});
VirtualTermList = withStyles(virtualTermListStyles)(VirtualTermList);

class TermList extends React.Component {
  addNewTerm = () => this.termDialog.addNewTerm()

  setTermCallback = err => {
    if(err) {
      core.showMainNotification('Failed', 'error');
    } else {
      core.showMainNotification('Saved', 'success');

      // do sync
      core.sync();
    }
  }

  render = () => {
    const {classes} = this.props;
    return (
      <div className={classes.root}>
        <VirtualTermList
          onRef={ref => {this.virtualTermList = ref}}
          openTerm={id => this.termDialog.openTerm(id)}
          refreshTermList={this.refreshTermList}
        />
        <Divider />
        <SimpleTooltips
          addNewTerm = {this.addNewTerm}
        />
        <TermDialog
          onRef = {ref => {this.termDialog = ref}}
          setTermCallback = {this.setTermCallback}
        />
      </div>
    );
  }
}

TermList.propTypes = {
  classes: PropTypes.object.isRequired,
  // theme: PropTypes.object.isRequired,
};
const listStyles = theme => ({
  root: {
    backgroundColor: theme.palette.background.paper,
  },
  container: {
    display: 'flex',
    flexWrap: 'wrap',
  },
});

export default withStyles(listStyles)(TermList);