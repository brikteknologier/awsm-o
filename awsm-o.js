var aws = require('aws-sdk');
var Batch = require('./batch');
var promise = require('augur');
var inspect = require('util').inspect;
var _ = require('underscore');

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

  if (!spec.awsCredentials) {
    throw new Error("awsCredentials must be specified for AwsmO constructor");
  } else {
    this.credentials = promise();
    if (typeof spec.awsCredentials == 'string') {
      var csvCredentials = spec.awsCredentials;
      require('./aws-credentials')(csvCredentials, this.credentials);
    } else if (spec.awsCredentials.accessKeyId &&
               spec.awsCredentials.secretAccessKey) {
      this.credentials(null, spec.awsCredentials);
    } else {
      throw new Error("malformed awsCredentials - expected csv file or object " +
                      "with accessKeyId & secretAccessKey, got " +
                      inspect(spec.awsCredentials));
    }
  } 
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
