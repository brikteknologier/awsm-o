var aws = require('aws-sdk');
var Batch = require('./batch');
var promise = require('augur');
var inspect = require('util').inspect;
var _ = require('underscore');
var dispatchers = require('./dispatchers');

function createZeroLogger() {
  var winston = require('winston');
  var TaggedConsoleTarget = require('tagged-console-target');
  var TaggedLogger = require('tagged-logger');

  var winstonLogger = new winston.Logger({ transports: [ ] });
  return new TaggedLogger(winstonLogger);
}

function AwsmO(opts) {
  if (!(this instanceof AwsmO)) return new AwsmO(opts);

  this.log = opts.log || createZeroLogger();
  this.opts = opts;


  this.credentials = createCredentialsPromise(opts.awsCredentials);
}

function createCredentialsPromise(credentials) {
  if (!credentials) 
    throw new Error("awsCredentials must be specified for AwsmO constructor");

  var credentialsPromise = promise();
  if (typeof credentials == 'string') {
    require('./aws-credentials')(credentials, credentialsPromise);
  } else if (credentials.accessKeyId && credentials.secretAccessKey) {
    credentialsPromise(null, credentials);
  } else {
    throw new Error("malformed awsCredentials - expected csv file or object " +
                    "with accessKeyId & secretAccessKey, got " +
                    inspect(spec.awsCredentials));
  }
  return credentialsPromise;
}


AwsmO.prototype.ec2 = function (callback) {
  this.getCredentials(function (err, credentials) {
    if (err) return callback(err);

    aws.config.update(credentials);
    aws.config.update({ region: this.awsRegion });
    var ec2 = new aws.EC2({ apiVersion: '2013-08-15' });
    callback(null, ec2);
  }.bind(this));
};

module.exports = AwsmO;
