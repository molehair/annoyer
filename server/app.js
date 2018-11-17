const express = require('express');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const logger = require('./logger');
const common = require('./common');

app.use(helmet());
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(morgan('combined', { stream: logger.stream }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

common.init(app);

module.exports = app;
