var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var async = require('async')
var resolve = require('./util').resolve;

function Ec2Instance(awsmo) {
  EventEmitter.call(this);
  var self = this;
  this.awsmo = awsmo;
}

inherits(Ec2Instance, EventEmitter);
module.exports = {
  create: createEC2Instance,
  get: getEC2Instance
};

Ec2Instance.prototype.setName = function(name, callback) {
  var self = this;
  return this.awsmo.task(function(callback) {
    resolve([this.awsmo.ec2, this.instanceId], function(err, ec2, instanceId) {
      if (err) return (callback || self._catchError)(err);

      ec2.createTags({
        Resources: [instanceId],
        Tags: [{ Key: "Name", Value: name }]
      }, function (err, nameData) {
        if (err) return callback(err);
        else callback && callback();
      });
    });
  }).then(callback || this.awsmo._catchError);
};

function createEC2Instance(awsmo, opts, callback) {
  var instance = new Ec2Instance(awsmo);
  callback = callback || awsmo._catchError;
  instance.instanceId = this.awsmo.task(function(callback) {
    awsmo.ec2.then(function(err, ec2) {
      ec2.runInstances({
        ImageId: opts.imageId,
        MinCount: 1,
        MaxCount: 1,
        KeyName: opts.key,
        SecurityGroupIds: opts.securityGroupIds,
        InstanceType: opts.instanceType || "t1.micro",
        Placement: {
          AvailabilityZone: opts.availabilityZone || "eu-west-1b"
        }
      }, function (err, data) {
        if (err) return callback(err);
        callback(null, data.Instances[0].InstanceId);
      });
    });
  });
  instance.instanceId.then(function(err, instanceId) {
    if (err) return (callback)(err);
    instance.setName(name || 'AWSM-O instance', callback);
  });
  return instance;
}

function getEC2Instance(awsmo, instanceId, callback) {
  var instance = new Ec2Instance(awsmo); 
  instance.instanceId = promise()(null, instanceId);

  // TODO - go and get some info and set it on the machine - create should also
  // do this. Until then, call the callback on the next tick.
  process.nextTick(function() { callback() });

  return instance;
};
