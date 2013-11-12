var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var async = require('async')
var util = require('./util');
var promise = require('augur');
var resolve = util.resolve;

function Ec2Instance(awsmo) {
  EventEmitter.call(this);
  this.awsmo = awsmo;
  this.log = awsmo.log.createSublogger('ec2-instance');
  this.publicDnsName = promise();
}

inherits(Ec2Instance, EventEmitter);
module.exports = {
  create: createEC2Instance,
  get: getEC2Instance
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
  instance.setName(name || 'AWSM-O instance', callback);
  this.resolvePublicDnsName(this.publicDnsName);
  return instance;
}

function getEC2Instance(awsmo, instanceId, callback) {
  var instance = new Ec2Instance(awsmo); 
  instance.instanceId = promise()(null, instanceId);

  // TODO - go and get some info and set it on the machine - create should also
  // do this. Until then, call the callback on the next tick.
  if (callback) process.nextTick(function() { callback() });

  this.resolvePublicDnsName(this.publicDnsName);

  return instance;
};

Ec2Instance.prototype.resolvePublicDnsName = function(callback) {
  var self = this;
  return this.awsmo.task(function(callback) {
    resolve([self.awsmo.ec2, self.instanceId], function(err, ec2, instanceId) {
      if (err) return callback(err);
      var publicDnsName = null;
      var log = self.log.createSublogger("pollForPublicDnsName");
      async.doUntil(
        function poll(callback) {
          log.info('Polling...');
          ec2.describeInstances({ 
            InstanceIds: [ instanceId ]
          }, function(err, results) {
            if (err) return callback(err);

            var state = results.Reservations[0].Instances[0].State.Name;
            if (state !== 'pending' && state !== 'running') 
              return callback(new Error("Invalid state. Will never get PublicDNSName"));

            publicDnsName = results.Reservations[0].Instances[0].PublicDnsName;

            if (publicDnsName) callback();
            else setTimeout(callback, 10000);
          })
        },
        function () { return !!publicDnsName },
        function (err) {
          if (err) return callback(err);
          else return callback(null, publicDnsName);
        }
      );
    });
  }).then(callback || function() {});
};

Ec2Instance.prototype.setName = function(name, callback) {
  var self = this;
  return this.awsmo.task(function(callback) {
    resolve([self.awsmo.ec2, self.instanceId], function(err, ec2, instanceId) {
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
