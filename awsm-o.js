var aws = require('aws-sdk');
var Batch = require('./batch');
var promise = require('augur');
var inspect = require('util').inspect;
var _ = require('underscore');
var dispatchers = require('./dispatchers');

function AwsmO(opts) {
  if (!(this instanceof AwsmO)) return new AwsmO(opts);

  this.log = opts.log || createZeroLogger();
  this.opts = opts;

  this.credentials = getCredentials(opts.awsCredentials);
  this.ec2 = getEc2Object(this.credentials, opts.region);
};

function getCredentials(credentials) {
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
};

function getEc2Object(credentials, region) {
  var ec2 = promise();
  credentials.then(function(err, credentials) {
    if (err) return ec2(err);

    aws.config.update(credentials);
    aws.config.update({ region: region });
    var ec2 = new aws.EC2({ apiVersion: '2013-08-15' });
    callback(null, ec2);
  });
  return ec2;
};

function createZeroLogger() {
  var winston = require('winston');
  var TaggedConsoleTarget = require('tagged-console-target');
  var TaggedLogger = require('tagged-logger');

  var winstonLogger = new winston.Logger({ transports: [ ] });
  return new TaggedLogger(winstonLogger);
};

module.exports = AwsmO;
