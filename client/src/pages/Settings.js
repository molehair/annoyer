import React from 'react';
import core from '../core';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import fileDownload from 'js-file-download';
import Button from '@material-ui/core/Button';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListItemText from '@material-ui/core/ListItemText';
import ListSubheader from '@material-ui/core/ListSubheader';
import Switch from '@material-ui/core/Switch';
import Divider from '@material-ui/core/Divider';
import TextField from '@material-ui/core/TextField';
import Grid from '@material-ui/core/Grid';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContentText from '@material-ui/core/DialogContentText';
import FormControl from '@material-ui/core/FormControl';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import Icon from '@mdi/react'
import {
  mdiBellOutline,
  mdiAlarm,
  mdiCalendarRange,
  mdiFace,
  mdiKey,
  mdiLogout,
  mdiCloudDownload,
  mdiCloudUpload,
  mdiAccountRemoveOutline,
} from '@mdi/js'
import IconButton from '@material-ui/core/IconButton';
import Dropzone from 'react-dropzone'
import Typography from '@material-ui/core/Typography';
import red from '@material-ui/core/colors/red';
import blue from '@material-ui/core/colors/blue';
import grey from '@material-ui/core/colors/grey';

class CloseAccountDialog extends React.Component {
  state = {
    open: false,
  }
  constructor(props) {
    super(props);
    this.props.onRef(this);
  }
  
  componentDidMount= () => this.close()
  show = () => this.setState({open: true})
  close = () => this.setState({open: false, ok: ''})
  handleOK = ok => this.setState({ok})
  deleteAccount = async () => {
    if(this.state.ok === 'OK') {
      try {
        await core.closeAccount();
        core.showMainNotification('GoodBye!', 'success', 3000);
        setTimeout(() => core.changePage('signin'), 3000);
      } catch(err) {
        console.error(err);
      }
    } else {
      core.showMainNotification('Type \'OK\' correctly.', 'error');
    }
  }
  
  render() {
    const {classes} = this.props;
    return (
      <Dialog
        open={this.state.open}
        onClose={this.close}
        aria-labelledby="form-dialog-title"
        classes={{paper: classes.dialogPaper}}
      >
        <DialogTitle id="form-dialog-title" style={{paddingBottom:0}}>Account Closing</DialogTitle>
          <DialogContent style={{paddingTop:0}}>
            <DialogContentText>
              Type capital 'OK' to destroy your account.
            </DialogContentText>
            <TextField
              autoFocus
              margin="dense"
              id="ok"
              value={this.state.ok}
              fullWidth
              onChange={event => this.handleOK(event.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={this.deleteAccount} color="secondary">
              Delete
            </Button>
            <Button onClick={this.close} color="primary">
              Cancel
            </Button>
          </DialogActions>
      </Dialog>
    );
  }
}
CloseAccountDialog.propTypes = {
  classes: PropTypes.object.isRequired,
};
const closeAccountDialogStyles = theme => ({
  form: {
    width: '100%', // Fix IE11 issue.
    marginTop: theme.spacing.unit,
  },
  dialogPaper: {
    minWidth: '95vw',
    // minHeight: 340,
  },
});
CloseAccountDialog = withStyles(closeAccountDialogStyles)(CloseAccountDialog);


class ChangePasswordDialog extends React.Component {
  state = {
    open: false,
  }
  constructor(props) {
    super(props);
    this.props.onRef(this);
  }
  
  componentDidMount= () => this.close()
  show = () => this.setState({open: true})
  handleOldPassword = event => this.setState({oldPassword: event.target.value})
  handleNewPassword = event => this.setState({newPassword: event.target.value})
  handleNewPasswordRepeat = event => this.setState({newPasswordRepeat: event.target.value})
  
  close = () => {
    this.setState({
      open: false,
      oldPassword: '',
      newPassword: '',
      newPasswordRepeat: '',
    });
  };
  
  handlePasswordSubmit = async event => {
    event.preventDefault();

    // check password repeat match
    if(this.state.newPassword !== this.state.newPasswordRepeat) {
      core.showMainNotification('Repeat new password correctly', 'error');
      return;
    }

    try {
      // do
      await core.changePassword(this.state.oldPassword, this.state.newPassword);
      core.showMainNotification('Successfully changed', 'success');
    } catch(err) {
      core.showMainNotification(err.message || 'Failed to change', 'error');
    }

    this.close();
  };

  render() {
    const { classes } = this.props;
    return (
      <Dialog
        open={this.state.open}
        onClose={this.close}
        aria-labelledby="form-dialog-title"
        classes={{paper: classes.dialogPaper}}
      >
        <DialogTitle id="form-dialog-title" style={{paddingBottom:0}}>Change Password</DialogTitle>
        <form className={classes.form} onSubmit={(event) => this.handlePasswordSubmit(event)}>
          <DialogContent style={{paddingTop:0}}>
              <FormControl margin="normal" required fullWidth>
                <InputLabel htmlFor="oldPassword">Current Password</InputLabel>
                <Input
                  id="oldPassword"
                  name="oldPassword"
                  type="password"
                  autoComplete="oldPassword"
                  autoFocus
                  value={this.state.oldPassword || ''}
                  onChange={this.handleOldPassword}
                />
              </FormControl>
              <FormControl margin="normal" required fullWidth>
                <InputLabel htmlFor="newPassword">New Password</InputLabel>
                <Input
                  name="newPassword"
                  type="password"
                  id="newPassword"
                  autoComplete="newPassword"
                  value={this.state.newPassword || ''}
                  onChange={this.handleNewPassword}
                />
              </FormControl>
              <FormControl margin="normal" required fullWidth>
                <InputLabel htmlFor="newPasswordRepeat">Repeat New Password</InputLabel>
                <Input
                  name="newPasswordRepeat"
                  type="password"
                  id="newPasswordRepeat"
                  autoComplete="newPasswordRepeat"
                  value={this.state.newPasswordRepeat || ''}
                  onChange={this.handleNewPasswordRepeat}
                />
              </FormControl>
          </DialogContent>
          <DialogActions>
            <Button
              type="submit"
              color="primary"
            >
              Save
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    );
  }
}
ChangePasswordDialog.propTypes = {
  classes: PropTypes.object.isRequired,
};
const changePasswordDialogStyles = theme => ({
  form: {
    width: '100%', // Fix IE11 issue.
    marginTop: theme.spacing.unit,
  },
  dialogPaper: {
    minWidth: '95vw',
    minHeight: 340,
  },
});
ChangePasswordDialog = withStyles(changePasswordDialogStyles)(ChangePasswordDialog);

class SettingsList extends React.Component {
  state = {
    alarmEnabled: false,
    alarmClock: "",
    enabledDays: [false, false, false, false, false, false, false],
    email: '',
    extendRestore: false,
    isDropping: false,
  }

  componentDidMount = async () => {
    let {alarmEnabled, alarmClock, enabledDays, email} = await core.getSettings();
    
    // alarmClock: UTC to local
    const offset = new Date().getTimezoneOffset();    // offset to UTC
    alarmClock = (alarmClock - offset);               // local time, before range adjust
    alarmClock = alarmClock % (24*60);          // intermediate
    alarmClock = (alarmClock >= 0) ? alarmClock : alarmClock + 26*60;   // adjusted. Range: [0, 24*60)
    
    // alarmClock: number to string
    const hour = ('' + Math.floor(alarmClock / 60)).padStart(2, '0');
    const minute = ('' + (alarmClock % 60)).padStart(2, '0');
    alarmClock = hour + ':' + minute;
    
    this.setState({alarmEnabled, alarmClock, enabledDays, email});
  }

  handleAlarmEnabled = async alarmEnabled => {
    if(alarmEnabled) {
      try {
        await core.registerToken();
      } catch(err) {
        core.showMainNotification(err.message, 'error');
      }
    } else {
      try {
        await core.deregisterToken();
      } catch(err) {
        console.error(err.message);
      }
    }
    return this.setSettings({alarmEnabled});
  }
  handleAlarmClock = alarmClock => this.setSettings({alarmClock})
  handleEnabledDays = index => {
    let enabledDays = this.state.enabledDays;
    enabledDays[index] = !enabledDays[index];
    this.setSettings({enabledDays});
  }
  
  setSettings = async setting => {
    const entry = Object.keys(setting)[0];
    const oldValue = this.state[entry];

    // transform alarmClock
    if(entry === 'alarmClock') {
      let alarmClock = setting[entry];
      const [hour, minute] = alarmClock.split(':');
      alarmClock = parseInt(hour, 10) * 60 + parseInt(minute, 10);    // local time
      const offset = new Date().getTimezoneOffset();    // offset to UTC
      alarmClock = alarmClock + offset;  // UTC time
      alarmClock = (alarmClock + 24*60) % (24*60);    // range adjustment [0,24*60)
      this.setState({alarmClock: setting[entry]});
      setting = {alarmClock};   // send transformed alarmClock
    } else {
      this.setState(setting);
    }

    // set settings
    try {
      await core.setSettings(setting);
    } catch(err) {
      core.showMainNotification(err.message || 'Failed', 'error');
      setting[entry] = oldValue;
      this.setState(setting);
      return false;
    }

    return true;
  }

  handleLogout = async () => {
    try{
      await core.logout();
      core.changePage('signin');
    } catch(err) {
      core.showMainNotification(err.message || 'Failed', 'error');
    }
  }

  handleRestore = () => {
    const extendRestore = !this.state.extendRestore;
    this.setState({extendRestore});
  }
  
  onDropAccepted = async files => {
    this.setState({isDropping: false});

    try {
      await core.restore(files[0]);
      core.showMainNotification('Done', 'success');
    } catch(err) {
      console.error(err);
      core.showMainNotification(err.message || 'Can\'t restore', 'error');
    }
  }
  
  onDropRejected = files => {
    this.setState({isDropping: false});
    core.showMainNotification('CSV file only', 'error');
  }

  handleBackup = async () => {
    const csv = await core.backup();
    fileDownload(csv, 'annoyer.csv');
  }
  
  handleCloseAccount = () => this.props.showCloseAccountDialog()

  render() {
    const { classes } = this.props;

    return (
      <div className={classes.root}>
        <List subheader={<ListSubheader disableSticky>Schedule</ListSubheader>}>
          <ListItem>
            <Icon path={mdiBellOutline} size={1} />
            <ListItemText primary="Notification" />
            <ListItemSecondaryAction>
              <Switch
                onChange={event => this.handleAlarmEnabled(event.target.checked)}
                checked={this.state.alarmEnabled}
              />
            </ListItemSecondaryAction>
          </ListItem>
          <ListItem>
            <Icon path={mdiAlarm} size={1} />
            <ListItemText primary="Alarm Clock" />
            <ListItemSecondaryAction>
              <form className={classes.container} noValidate>
                <TextField
                  id="alarmClock"
                  // label="Alarm clock"
                  type="time"
                  value={this.state.alarmClock}
                  className={classes.textField}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  inputProps={{
                    step: 300, // in sec
                  }}
                  onChange={event => this.handleAlarmClock(event.target.value)}
                />
              </form>
            </ListItemSecondaryAction>
          </ListItem>
          <ListItem>
            <Icon path={mdiCalendarRange} size={1} />
            <ListItemText primary="Days of practice" />
          </ListItem>
          <ListItem>
              <Grid container justify="space-around" direction="row" alignItems="center" spacing={16}>
                {[
                  [0, 'Sun'],
                  [1, 'Mon'],
                  [2, 'Tue'],
                  [3, 'Wed'],
                  [4, 'Thr'],
                  [5, 'Fri'],
                  [6, 'Sat']
                ].map(x => (
                  <Grid item key={x[0]} xs='auto'>
                    <Button
                      size="small"
                      variant={(this.state.enabledDays[x[0]]) ? "contained" : "outlined"}
                      color={(this.state.enabledDays[x[0]]) ? "primary" : "default"}
                      onClick={() => this.handleEnabledDays(x[0])}
                    >
                      {x[1]}
                    </Button>
                  </Grid>
                ))}
              </Grid>
            {/* </ListItemSecondaryAction> */}
          </ListItem>
        </List>
        <Divider />
        <List subheader={<ListSubheader disableSticky>Terms</ListSubheader>}>
          <ListItem button onClick={() => this.handleBackup()}>
            <Icon path={mdiCloudDownload} size={1} />
            <ListItemText primary="Backup" />
          </ListItem>
          <ListItem button onClick={() => this.handleRestore()}>
            <Icon path={mdiCloudUpload} size={1} />
            <ListItemText primary="Restore" />
          </ListItem>
          { this.state.extendRestore &&
            <ListItem button>
              <Grid
                container
                justify='center'
                alignItems='center'
              >
                <Grid item>
                  <Dropzone
                    accept='.csv'
                    onDropAccepted={this.onDropAccepted}
                    onDropRejected={this.onDropRejected}
                    onDragEnter={() => this.setState({isDropping: true})}
                    onDragLeave={() => this.setState({isDropping: false})}
                    style={{
                      width: '80vw',
                      height: '10vw',
                      border: (this.state.isDropping) ? '3px dashed ' +blue[500] : '2px dashed #888'
                    }}
                  >
                    <Grid
                      container
                      justify='center'
                      alignItems='center'
                      style={{height:'100%'}}
                    >
                      <Grid item>
                        <Typography>
                          Drop <font color={red[500]}>.csv</font> or click here
                        </Typography>
                      </Grid>
                    </Grid>
                  </Dropzone>
                </Grid>
              </Grid>
            </ListItem>
          }
        </List>
        <Divider />
        <List subheader={<ListSubheader disableSticky>Account</ListSubheader>}>
          <ListItem>
            <Icon path={mdiFace} size={1} />
            <ListItemText primary={this.state.email} />
            <ListItemSecondaryAction>
              <IconButton
                aria-label="Close Account"
                onClick={this.handleCloseAccount}
              >
                <Icon
                  path={mdiAccountRemoveOutline}
                  size={1}
                  color={grey[500]}
                />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
          <ListItem button onClick={this.props.showChangePasswordDialog}>
            <Icon path={mdiKey} size={1} />
            <ListItemText primary="Change Password" />
          </ListItem>
          <ListItem button onClick={this.handleLogout}>
            <Icon path={mdiLogout} size={1} />
            <ListItemText primary="Logout" />
          </ListItem>
        </List>
      </div>
    );
  }
}

SettingsList.propTypes = {
  classes: PropTypes.object.isRequired,
};
const settingsListStyles = theme => ({
  root: {
    width: '100%',
    backgroundColor: theme.palette.background.paper,
  },
  container: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  textField: {
    marginLeft: theme.spacing.unit,
    marginRight: theme.spacing.unit,
  },
});
SettingsList = withStyles(settingsListStyles)(SettingsList);


class Settings extends React.Component {
  showCloseAccountDialog = () => this.closeAccountDialog.show()
  showChangePasswordDialog = () => this.changePasswordDialog.show()
  render() {
    return (
      <main>
        <CloseAccountDialog
          onRef = {ref => {this.closeAccountDialog = ref}}
        />
        <ChangePasswordDialog
          onRef = {ref => {this.changePasswordDialog = ref}}
        />
        <SettingsList
          showCloseAccountDialog = {this.showCloseAccountDialog}
          showChangePasswordDialog = {this.showChangePasswordDialog}
        />
      </main>
    );
  }
}
export default Settings;