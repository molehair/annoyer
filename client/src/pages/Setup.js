import React from 'react';
import core from '../core';
import PropTypes from 'prop-types';
import Button from '@material-ui/core/Button';
import FormControl from '@material-ui/core/FormControl';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import withStyles from '@material-ui/core/styles/withStyles';
import Icon from '@mdi/react'
import { mdiPower } from '@mdi/js'


class Setup extends React.Component {
  state = {
    serverAddress: 'http://192.168.1.8:3000',
    pushyAppId: '5badc00e64e87eb07b171299',
  }
  handleServerAddress = (serverAddress) => this.setState({serverAddress})
  handlePushyAppId = (pushyAppId) => this.setState({pushyAppId})
  handleSubmit(event) {
    event.preventDefault();
    core.init(this.state.serverAddress, this.state.pushyAppId)
    .then(() => this.props.setupDone());
  }
  render() {
    const { classes } = this.props;

    return (
      <main className={classes.layout}>
        <Paper className={classes.paper}>
          <Icon path={mdiPower} size='3em' />
          <Typography component="h1" variant="h5">
            Setup
          </Typography>
          <form className={classes.form} onSubmit={event => this.handleSubmit(event)}>
            <FormControl margin="normal" required fullWidth>
              <InputLabel htmlFor="serverAddress">Server Address</InputLabel>
              <Input
                id="serverAddress"
                name="serverAddress"
                autoComplete="serverAddress"
                autoFocus
                value={this.state.serverAddress}
                onChange={event => this.handleServerAddress(event.target.value)}
              />
            </FormControl>
            <FormControl margin="normal" required fullWidth>
              <InputLabel htmlFor="pushyAppId">PushyAppId</InputLabel>
              <Input
                id="pushyAppId"
                name="pushyAppId"
                autoComplete="pushyAppId"
                value={this.state.pushyAppId}
                onChange={event => this.handlePushyAppId(event.target.value)}
              />
            </FormControl>
            {/* <FormControlLabel
              control={<Checkbox value="remember" color="primary" />}
              label="Remember me"
            /> */}
            <FormControl margin="dense" fullWidth>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                className={classes.submit}
              >
                Go
              </Button>
            </FormControl>
          </form>
        </Paper>
      </main>
    );
  }
}

Setup.propTypes = {
  classes: PropTypes.object.isRequired,
};

const setupStyles = theme => ({
  layout: {
    display: 'block', // Fix IE11 issue.
    width: '95vw',
    maxWidth: 400,
    marginLeft: 'auto',
    marginRight: 'auto',
    marginTop: '5vh',
  },
  paper: {
    marginBottom: 5,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: `${theme.spacing.unit * 2}px ${theme.spacing.unit * 3}px ${theme.spacing.unit * 3}px`,
  },
  avatar: {
    margin: theme.spacing.unit,
    backgroundColor: theme.palette.secondary.main,
  },
  form: {
    width: '100%', // Fix IE11 issue.
    marginTop: theme.spacing.unit,
  },
  submit: {
    marginTop: theme.spacing.unit * 3,
  },
});

export default withStyles(setupStyles)(Setup);
