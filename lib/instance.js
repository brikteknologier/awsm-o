var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var async = require('async')
var util = require('./util');
var promise = require('augur');
var resolve = util.resolve;
var SSHCommand = require('./ssh');
var SCP = require('./scp');

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
  callback = callback || instance._catchError();
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
  resolvePublicDnsName.call(instance);
  return instance;
}

function getEC2Instance(awsmo, instanceId, callback) {
  var instance = new Ec2Instance(awsmo); 
  instance.instanceId = promise()(null, instanceId);

  // TODO - go and get some info and set it on the machine - create should also
  // do this. Until then, call the callback on the next tick.
  if (callback) process.nextTick(function() { callback() });

  resolvePublicDnsName.call(instance);

  return instance;
};

function getState(ec2, instanceId, callback) {
  ec2.describeInstances({ 
    InstanceIds: [ instanceId ] 
  }, function(err, result) {
    if (err) return callback(err);
    callback(null, result.Reservations[0].Instances[0].State.Name);
  });
};

function awaitState(state, callback) {
  var self = this;
  var log = this.log.createSublogger('awaitState("' + state + '")');
  resolve([this.awsmo.ec2, this.instanceId], function(err, ec2, instanceId) {
    if (err) return callback(err);
    var achievedState = false;
    async.doUntil(
      function(callback) {
        log.info('Checking state of ' + instanceId);
        getState(ec2, instanceId, function(err, currentState) {
          if (err) return callback(err);
          log.info('Got state "' + currentState + '" for ' + instanceId);
          achievedState = currentState.toLowerCase() == state.toLowerCase();
          if (achievedState) callback();
          else setTimeout(callback, self.awsmo.opts.pollDelay);
        });
      },
      function() { return achievedState },
      callback
    );
  });
}

Ec2Instance.prototype._catchError = function() {
  var self = this;
  return function(err) {
    if (!err) return;
    self.emit('error', err);
  };
}

Ec2Instance.prototype.getState = function(callback) {
  var self = this;
  return this.awsmo.task(function(callback) {
    resolve([self.awsmo.ec2, self.instanceId], function(err, ec2, instanceId) {
      if (err) return callback(err);
      getState(ec2, instanceId, callback);
    });
  }).then(callback || this._catchError());
};

function resolvePublicDnsName(callback) {
  var self = this;
  return this.awsmo.task(function(callback) {
    resolve([self.awsmo.ec2, self.instanceId], function(err, ec2, instanceId) {
      if (err) return callback(err);
      var publicDnsName = null;
      var log = self.log.createSublogger("resolveDnsName(" + instanceId + ")");
      async.doUntil(
        function poll(callback) {
          log.info('Checking for dns name...');
          ec2.describeInstances({ 
            InstanceIds: [ instanceId ]
          }, function(err, results) {
            if (err) return callback(err);

            var state = results.Reservations[0].Instances[0].State.Name;
            if (state !== 'pending' && state !== 'running') 
              return callback(new Error("Invalid state. Will never get PublicDNSName"));

            publicDnsName = results.Reservations[0].Instances[0].PublicDnsName;

            log.info('PublicDNSName was ' + publicDnsName);

            if (publicDnsName) callback();
            else setTimeout(callback, self.awsmo.opts.pollDelay);
          })
        },
        function () { return !!publicDnsName },
        function (err) {
          if (err) return callback(err);
          else return callback(null, publicDnsName);
        }
      );
    });
  }).then(function(err, publicDnsName) {
    self.publicDnsName(err, publicDnsName);
  });
};

Ec2Instance.prototype.setName = function(name, callback) {
  var self = this;
  return this.awsmo.task(function(callback) {
    resolve([self.awsmo.ec2, self.instanceId], function(err, ec2, instanceId) {
      if (err) return callback(err);

      ec2.createTags({
        Resources: [instanceId],
        Tags: [{ Key: "Name", Value: name }]
      }, function (err, nameData) {
        if (err) return callback(err);
        else callback && callback();
      });
    });
  }).then(callback || this._catchError());
};

Ec2Instance.prototype.ssh = function(command, callback) {
  return new SSHCommand(this, command, callback);
};

Ec2Instance.prototype.scp = function(from, to, callback) {
  return new SCP(this, from, to, callback);
};

Ec2Instance.prototype.stop = function (callback) {
  var self = this;
  return this.awsmo.task(function(callback) {
    resolve([self.awsmo.ec2, self.instanceId], function(err, ec2, instanceId) {
      ec2.stopInstances({ InstanceIds: [ instanceId ] }, function (err, data) {
        if (err) return callback(err);
        self.publicDnsName = promise();
        awaitState.call(self, 'stopped', callback);
      });
    });
  }).then(callback || this._catchError());
};

Ec2Instance.prototype.terminate = function (callback) {
  var self = this;
  return this.awsmo.task(function(callback) {
    resolve([self.awsmo.ec2, self.instanceId], function(err, ec2, instanceId) {
      ec2.terminateInstances({ InstanceIds: [ instanceId ] }, function (err, data) {
        if (err) return callback(err);
        self.publicDnsName = promise();
        awaitState.call(self, 'terminated', callback);
      });
    });
  }).then(callback || this._catchError());
};

Ec2Instance.prototype.start = function(callback) {
  var self = this;
  return this.awsmo.task(function(callback) {
    resolve([self.awsmo.ec2, self.instanceId], function(err, ec2, instanceId) {
      ec2.startInstances({ InstanceIds: [ instanceId ] }, function (err, data) {
        if (err) return callback(err);
        awaitState.call(self, 'running', callback);
      });
    });
  }).then(callback || this._catchError());
  resolvePublicDnsName.call(this);;
};

Ec2Instance.prototype.reboot = function(callback) {
  var self = this;
  return this.awsmo.task(function(callback) {
    resolve([self.awsmo.ec2, self.instanceId], function(err, ec2, instanceId) {
      ec2.rebootInstances({ InstanceIds: [ instanceId ] }, function (err, data) {
        if (err) return callback(err);
        callback()
      });
    });
  }).then(callback || this._catchError());
};

Ec2Instance.prototype.createAmi = function(baseName, amiDescription, callback) {
  var self = this;
  var suffix = 1;
  return this.awsmo.task(function(callback) {
    resolve([self.awsmo.ec2, self.instanceId], function(err, ec2, instanceId) {
      var log = self.log.createSublogger("createAmi(" + instanceId + ")");
      if (err) return callback(err);
      var createImageCallback = function (err, data) {
        if (err) {
          if (err.code == "InvalidAMIName.Duplicate") {
            log.info("Name was taken.");
            return createImage(baseName + " " + (++suffix), createImageCallback);
          } else {
            return callback(err);
          }
        }
        var imageId = data.ImageId;
        log.info("Created AMI " + imageId);
        callback(null, imageId);
      };

      var createImage = function(name, callback) {
        log.info("attempting to create AMI with name " + name);
        ec2.createImage({
          InstanceId: instanceId,
          Name: name,
          Description: amiDescription
        }, createImageCallback);
      };

      createImage(baseName, createImageCallback);
    });
  });
};
