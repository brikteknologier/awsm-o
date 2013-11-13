var aws = require('aws-sdk');
var inspect = require('util').inspect;
var dispatchers = require('./dispatchers');
var instance = require('./instance');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;

function AwsmO(opts) {
  if (!(this instanceof AwsmO)) return new AwsmO(opts);

  EventEmitter.call(this);

  this.log = opts.log || createZeroLogger();
  this.opts = opts;
  
  this.opts.pollDelay = 10000;

  this.task = opts.sequential ? dispatchers.sync() : dispatchers.async();

  this.credentials = getCredentials.call(this);
  this.ec2 = getEc2Object.call(this);
};

inherits(AwsmO, EventEmitter);

function getCredentials() {
  if (!this.opts.awsCredentials) 
    throw new Error("awsCredentials must be specified for AwsmO constructor");

  var credentials = this.opts.awsCredentials;
  return this.task(function(callback) {
    if (typeof credentials == 'string') {
      require('./aws-credentials')(credentials, callback);
    } else if (credentials.accessKeyId && credentials.secretAccessKey) {
      callback(null, credentials);
    } else {
      callback(new Error("malformed awsCredentials - expected csv file or object " +
                      "with accessKeyId & secretAccessKey, got " +
                      inspect(credentials)));
    }
  });
};

function getEc2Object() {
  var self = this;
  var ec2 = this.task(function(callback) {
    self.credentials.then(function(err, credentials) {
      if (err) return ec2(err);

      aws.config.update(credentials);
      aws.config.update({ region: self.opts.region });
      var ec2 = new aws.EC2({ apiVersion: '2013-08-15' });
      callback(null, ec2);
    });
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

AwsmO.prototype.getInstance = function (instanceId, callback) {
  return instance.get(this, instanceId, callback);   
};

AwsmO.prototype.createInstance = function (opts, callback) {
  return instance.create(this, opts, callback);
};
  
// If the user didn't supply a callback, use this function instead of the
// callback to fire the error event (unignorable). For convenience.
AwsmO.prototype._catchError = function() {
  var self = this;
  return function(err) {
    if (!err) return;
    self.emit('error', err);
  };
}


module.exports = AwsmO;
