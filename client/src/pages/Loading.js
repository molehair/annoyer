import React from 'react';
import Grid from '@material-ui/core/Grid';
import logo from '../logo.svg';
import CircularProgress from '@material-ui/core/CircularProgress';
import blueGrey from '@material-ui/core/colors/blueGrey';

class Loading extends React.Component {
  componentDidMount = () => this.props.onRef(this)

  render() {
    return (
      <Grid container
        direction='row'
        justify='center'
        alignItems='center'
        style={{
          backgroundColor:blueGrey[100],
          height:'100vh',
          paddingTop: '10%',
        }}
      >
        <Grid item xs={12}>
          <img src={logo} width='40%' alt='logo'/>
        </Grid>
        <Grid item xs={12}>
          <CircularProgress
            style={{ color: '#000' }}
            size='10%'
          />
        </Grid>
      </Grid>
    );
  }
}

export default Loading;