const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.json(),
  ),
  transports: [
    // Write to all logs with level `info` and below to `combined.log` 
    new winston.transports.File({
      filename: 'log/combined.log',
      maxsize: 500*1024,   // in byte
    }),
    // Write all logs error (and below) to `error.log`.
    // new winston.transports.File({ filename: 'log/error.log', level: 'error' }),
  ]
});
// If we're not in production then log to the `console`:
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
// create a stream object with a 'write' function that will be used by `morgan`
logger.stream = {
  write: function(message, encoding) {
    // use the 'info' log level so the output will be picked up by both transports (file and console)
    logger.info(message);
  },
};


module.exports = logger;