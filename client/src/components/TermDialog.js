import React from 'react';
import core from '../core';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControl from '@material-ui/core/FormControl';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';

const termDialogStyles = theme => ({
  form: {
    width: '100%', // Fix IE11 issue.
    marginTop: theme.spacing.unit,
  },
  dialogPaper: {
    minWidth: '95vw',
    minHeight: 420,
  },
});

class TermDialog extends React.Component {
  constructor(props) {
    super(props);
    this.props.onRef(this);
  }
  state = {
    open: false
  }
  
  componentDidMount= () => { this.handleClose(); }

  handleTerm = (event) => { this.setState({term: event.target.value}); };
  handleDef = (event) => { this.setState({def: event.target.value}); };
  handleEx = (event) => { this.setState({ex: event.target.value}); };
  handleMnemonic = (event) => { this.setState({mnemonic: event.target.value}); };
  
  handleClose = () => {
    this.setState({
      open: false,
      _id: '',
      type: 1,
      term: '',
      def: '',
      ex: '',
      mnemonic: '',
      isModifying: false,
    });
  };
  
  handleSubmit = (event) => {
    event.preventDefault();
    let t = {
      type: this.state.type,
      term: this.state.term,
      def: this.state.def,
      ex: this.state.ex,
      mnemonic: this.state.mnemonic || '',
    };
    if(this.state._id)
      t._id = this.state._id;
    
    core.setTerm(t, this.state.isModifying)
    .then(data => {
      if(this.props.setTermCallback)
        this.props.setTermCallback(data);
    });
    this.handleClose();
  };
  
  addNewTerm = () => this.setState({open: true, isModifying: false})
  openTerm = (id) => {
    this.setState({open: true, isModifying: true});
    core.getTerm(id).then((doc) => {
      if(doc) {
        this.setState({
          _id: doc._id,
          type: doc.type,
          term: doc.term,
          def: doc.def,
          ex: doc.ex,
          mnemonic: doc.mnemonic,
        });
      }
    });
  };

  render() {
    const { classes } = this.props;
    return (
      <Dialog
        open={this.state.open}
        onClose={this.handleClose}
        aria-labelledby="form-dialog-title"
        classes={{paper: classes.dialogPaper}}
      >
        <DialogTitle id="form-dialog-title" style={{paddingBottom:0}}>Term</DialogTitle>
        <form className={classes.form} onSubmit={event => this.handleSubmit(event)}>
          <DialogContent style={{paddingTop:0}}>
              <FormControl
                margin="normal"
                required
                fullWidth
                disabled={this.state.isModifying}
              >
                <InputLabel htmlFor="term">Term</InputLabel>
                <Input
                  id="term"
                  name="term"
                  autoComplete="term"
                  autoFocus
                  value={this.state.term || ''}
                  onChange={this.handleTerm}
                />
              </FormControl>
              <FormControl
                margin="normal"
                required
                fullWidth
                disabled={this.state.isModifying}
              >
                <InputLabel htmlFor="def">Definition</InputLabel>
                <Input
                  name="def"
                  type="def"
                  id="def"
                  autoComplete="def"
                  value={this.state.def || ''}
                  onChange={this.handleDef}
                />
              </FormControl>
              <FormControl margin="normal" required fullWidth>
                <InputLabel htmlFor="ex">Example</InputLabel>
                <Input
                  name="ex"
                  type="ex"
                  id="ex"
                  autoComplete="ex"
                  value={this.state.ex || ''}
                  onChange={this.handleEx}
                />
              </FormControl>
              <FormControl margin="normal" fullWidth>
                <InputLabel htmlFor="mnemonic">Mnemonic</InputLabel>
                <Input
                  name="mnemonic"
                  type="mnemonic"
                  id="mnemonic"
                  autoComplete="mnemonic"
                  value={this.state.mnemonic || ''}
                  onChange={this.handleMnemonic}
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
            <Button
              color="secondary"
              onClick={this.handleClose}
            >
              Cancel
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    );
  }
}
TermDialog.propTypes = {
  classes: PropTypes.object.isRequired,
};
export default withStyles(termDialogStyles)(TermDialog);