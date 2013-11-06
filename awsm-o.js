var aws = require('aws-sdk');
var Batch = require('./batch');

function createZeroLogger() {
  var winston = require('winston');
  var TaggedConsoleTarget = require('tagged-console-target');
  var TaggedLogger = require('tagged-logger');

  var winstonLogger = new winston.Logger({ transports: [ ] });
  return new TaggedLogger(winstonLogger);
}

function AwsmO(spec) {
  if (!(this instanceof AwsmO)) return new AwsmO(spec);

  if (typeof spec.awsCredentials === 'string') {
    var csvCredentials = spec.awsCredentials;
    this.getCredentials = function (callback) {
      require('./aws-credentials')(csvCredentials, callback);
    };
  } else {
    // TODO Support inline specification of awsCredentials
    throw new Error("awsCredentials must be specified for AwsmO constructor");
  }

  this.log = spec.log || createZeroLogger();

  this.awsRegion = spec.awsRegion;
  this.sshKeyMappings = spec.sshKeyMappings;
}

var nextBatchId = 1;
AwsmO.prototype.Batch = function () {
  return new Batch(this.log.createSublogger("batch#" + (nextBatchId++)), this);
};

AwsmO.prototype.getEC2Object = function (callback) {
  // TODO Add memoization for this function
  this.getCredentials(function (err, credentials) {
    if (err) return callback(err);

    aws.config.update(credentials);
    aws.config.update({ region: this.awsRegion });
    var ec2 = new aws.EC2({ apiVersion: '2013-08-15' });
    callback(null, ec2);
  }.bind(this));
};

module.exports = AwsmO;
