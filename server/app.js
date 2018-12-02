const express = require('express');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const logger = require('./logger');
const common = require('./common');
const fs = require('fs');

app.use(helmet());
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// logger
try {
  fs.mkdirSync('./log');
} catch (err) {
  if (err.code !== 'EEXIST') throw err
}
app.use(morgan('combined', { stream: logger.stream }));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set('port', process.env.PORT || 3000);

common.init(app);

module.exports = app;