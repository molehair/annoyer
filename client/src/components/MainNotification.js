import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import red from '@material-ui/core/colors/red';
import green from '@material-ui/core/colors/green';
import blue from '@material-ui/core/colors/blue';
import Grid from '@material-ui/core/Grid';
import Icon from '@mdi/react'
import { mdiCheck, mdiClose, mdiInformationVariant } from '@mdi/js'
import CircularProgress from '@material-ui/core/CircularProgress';
import semaphore from 'semaphore';

const mainNotificationStyles = theme => ({
  dialog: {
    width: '80vw',
    height: '80vh',
    marginLeft: 'auto',
    marginRight: 'auto',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
});

class MainNotification extends React.Component {
  constructor(props) {
    super(props);
    this.props.onRef(this);
  }
  state = {
    open: false,
    queue: [],
  }
  sem = semaphore(1);
  closer = setTimeout(() => {}, 0);
  
  add = (msg, type, time) => {
    // theme variables
    let image, imageType, color;
    if(type === 'success') {
      color = green[500];
      image = mdiCheck;
      imageType = 'icon';
    } else if(type === 'error') {
      color = red[500];
      image = mdiClose;
      imageType = 'icon';
    } else if(type === 'info') {
      color = blue[500];
      image = mdiInformationVariant;
      imageType = 'icon';
    } else if(type === 'loading') {
      image = (
        <CircularProgress
          style={{ color: '#000' }}
          thickness={7}
        />
      );
      imageType = 'others';
    }
    if(imageType === 'icon') {
      image = <Icon path={image} size='50' color={color} />;
    }

    this.sem.take(() => {
      let queue = this.state.queue;
      queue.push({msg, image, time});
      this.setState(queue);
      this.sem.leave();
    });
    this.open();
  }

  open = () => {
    this.sem.take(() => {
      const queue = this.state.queue;
      if(queue.length > 0 && !this.state.open) {
        // auto close
        if(typeof queue[0].time === 'undefined') {
          this.closer = setTimeout(this.close, 3000);
        } else if(typeof queue[0].time === 'number' && queue[0].time > 0) {
          this.closer = setTimeout(this.close, queue[0].time);
        }

        this.setState({open: true});
      }
      this.sem.leave();
    });
  }

  close = () => {
    clearTimeout(this.closer);
    this.sem.take(() => {
      let queue = this.state.queue;
      queue.shift();    // dequeue
      this.setState({queue, open: false});
      this.sem.leave();
    });
    this.open();
  };
  
  render() {
    const {classes} = this.props;
    const {msg, image} = this.state.queue[0] || {};

    if(this.state.queue.length > 0) {
      return (
        <Dialog
          open={this.state.open}
          onClose={this.close}
          aria-labelledby="form-dialog-title"
          className={classes.dialog}
        >
          <DialogContent>
            <Grid container
              direction="column"
              alignItems="center"
            >
              <Grid item xs={12}>
                {image}
              </Grid>
              <Grid item xs={12}>
                <DialogContentText style={{textAlign: "center"}}>
                  {msg}
                </DialogContentText>
              </Grid>
            </Grid>
          </DialogContent>
        </Dialog>
      );
    } else return (<div></div>);
  }
}
MainNotification.propTypes = {
  classes: PropTypes.object.isRequired,
};
export default withStyles(mainNotificationStyles)(MainNotification);