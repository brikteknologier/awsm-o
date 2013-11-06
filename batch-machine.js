var Machine = require('./machine');


function BatchMachine(log, awsmo, batch) {
  if (!(this instanceof BatchMachine)) return new BatchMachine(log, awsmo, batch);

  this.log = log;
  this.awsmo = awsmo;
  this.batch = batch;
}

function createEC2Instance(ec2, spec, callback) {
  // TODO Validate input

  ec2.runInstances({
    ImageId: spec.imageId,
    MinCount: 1,
    MaxCount: 1,
    KeyName: spec.key,
    SecurityGroupIds: spec.securityGroupIds,
    InstanceType: spec.instanceType || "t1.micro",
    Placement: {
      AvailabilityZone: "eu-west-1b"
    }
  }, function (err, data) {
    if (err) return callback(err);

    var instanceId = data.Instances[0].InstanceId;
    ec2.createTags({
      Resources: [ instanceId ],
      Tags: [
        {
          Key: "Name",
          Value: spec.name || "AWSM-O instance"
        }
      ]
    }, function (err, nameData) {
      callback(err, data);
    });
  });
}

BatchMachine.prototype.create = function (spec) {
  this.batch.sequence.push(function (callback) {
    // TODO Get ec2 from awsmo.getEC2Object when memoization is implemented
    this.log.info("Creating instance");
    createEC2Instance(this.batch.ec2, spec, function (err, data) {
      if (err) return callback(err);

      var instanceId = data.Instances[0].InstanceId;
      this.machine = new Machine(this.log.createSublogger(instanceId), this.awsmo, this.batch.ec2, instanceId);
      this.machine.setSshCredentials = { awsKeyName: spec.key };
      callback();
    }.bind(this));
  }.bind(this));

  this.pollUntilState("running");
  this.getPublicDNSName();
};

BatchMachine.prototype.loadRunning = function (instanceId) {
  this.batch.sequence.push(function (callback) {
    // TODO Get ec2 from awsmo.getEC2Object when memoization is implemented
    this.machine = new Machine(this.log.createSublogger(instanceId), this.awsmo, this.batch.ec2, instanceId);
    callback();
  }.bind(this));

  this.getPublicDNSName();
};

BatchMachine.prototype.setSshCredentials = function (credentials) {
  this.batch.sequence.push(function (callback) {
    this.machine.sshCredentials = credentials;
    callback(null);
  }.bind(this));
};

BatchMachine.prototype.ssh = function (cmd) {
  this.batch.sequence.push(function (callback) {
    this.machine.ssh(cmd, callback);
  }.bind(this));
  // TODO return a child_process like object?
};

BatchMachine.prototype.scp = function () {
  var args = Array.prototype.slice.call(arguments);
  this.batch.sequence.push(function (callback) {
    this.machine.scp.apply(this.machine, args.concat(callback));
  }.bind(this));
  // TODO return a child_process like object?
};

BatchMachine.prototype.getPublicDNSName = function () {
  this.batch.sequence.push(function (callback) {
    this.machine.pollForPublicDnsName(callback);
  }.bind(this));
};

BatchMachine.prototype.pollUntilSshAccess = function () {
  this.batch.sequence.push(function (callback) {
    this.machine.pollForSshAccess(callback);
  }.bind(this));
};

BatchMachine.prototype.pollUntilState = function (state) {
  this.batch.sequence.push(function (callback) {
    this.machine.pollUntilState(state, callback);
  }.bind(this));
};

BatchMachine.prototype.powerOff = function () {
  this.batch.sequence.push(function (callback) {
    this.machine.powerOff(callback);
  }.bind(this));
};

BatchMachine.prototype.terminate = function () {
  this.batch.sequence.push(function (callback) {
    this.machine.terminate(callback);
  }.bind(this));
};

module.exports = BatchMachine;
