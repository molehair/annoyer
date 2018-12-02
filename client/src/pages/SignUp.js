import React from 'react';
import core from '../core';
import PropTypes from 'prop-types';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import CssBaseline from '@material-ui/core/CssBaseline';
import FormControl from '@material-ui/core/FormControl';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import LockIcon from '@material-ui/icons/LockOutlined';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import withStyles from '@material-ui/core/styles/withStyles';

class SignUp extends React.Component {
  state = {
    email: '',
    password: '',
    passwordRepeat: '',
  }
  handleEmail(event) { this.setState({email: event.target.value}); }
  handlePassword(event) { this.setState({password: event.target.value}); }
  handlePasswordRepeat(event) { this.setState({passwordRepeat: event.target.value}); }
  handleSubmit(event) {
    event.preventDefault();
    if(this.state.password === this.state.passwordRepeat) {
      core.register(this.state.email, this.state.password, this.state.passwordRepeat)
      .then(data => {
        if(data.result) {
          //-- successful signup --//
          // register token(silent success)
          core.registerToken().catch(err => {
            core.showMainNotification(
              'Notification is blocked. You cannot receive the alarm.', 'info', 0);
          });

          // go to main
          core.changePage('main');
        } else {
          core.showMainNotification(data.msg || 'Registration failed.', 'error');
        }
      })
    } else {
      core.showMainNotification('Password mismatch', 'error');
    }
  }
  render() {
    const { classes } = this.props;

    return (
      <React.Fragment>
        <CssBaseline />
        <main className={classes.layout}>
          <Paper className={classes.paper}>
            <Avatar className={classes.avatar}>
              <LockIcon />
            </Avatar>
            <Typography component="h1" variant="h5">
              Create a new account
            </Typography>
            <form className={classes.form} onSubmit={(event) => this.handleSubmit(event)}>
              <FormControl margin="normal" required fullWidth>
                <InputLabel htmlFor="email">Email Address</InputLabel>
                <Input
                  id="email"
                  value={this.state.email}
                  name="email"
                  autoComplete="email"
                  autoFocus
                  onChange={(event) => this.handleEmail(event)}
                />
              </FormControl>
              <FormControl margin="normal" required fullWidth>
                <InputLabel htmlFor="password">Password</InputLabel>
                <Input
                  name="password"
                  type="password"
                  id="password"
                  autoComplete="current-password"
                  value={this.state.password}
                  onChange={(event) => this.handlePassword(event)}
                />
              </FormControl>
              <FormControl margin="normal" required fullWidth>
                <InputLabel htmlFor="passwordRepeat">Repeat Password</InputLabel>
                <Input
                  name="passwordRepeat"
                  type="password"
                  id="passwordRepeat"
                  autoComplete="current-password"
                  value={this.state.passwordRepeat}
                  onChange={(event) => this.handlePasswordRepeat(event)}
                />
              </FormControl>
              <FormControl margin="dense" fullWidth>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  className={classes.submit}
                >
                  Sign up
                </Button>
              </FormControl>
              <FormControl margin="dense" fullWidth>
                or
              </FormControl>
              <FormControl margin="dense" fullWidth>
                <Button
                  variant="outlined"
                  onClick={() => core.changePage('signin')}
                >
                  Sign in
                </Button>
              </FormControl>
            </form>
          </Paper>
        </main>
      </React.Fragment>
    );
  }
}

SignUp.propTypes = {
  classes: PropTypes.object.isRequired,
};

const styles = theme => ({
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

export default withStyles(styles)(SignUp);
