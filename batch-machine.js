var Machine = require('./machine');


function BatchMachine(log, awsmo, batch, instanceId) {
  if (!(this instanceof BatchMachine)) return new BatchMachine(log, awsmo, batch, instanceId);

  this.log = log;
  this.batch = batch;

  this.batch.sequence.push(function (callback) {
    // TODO Get ec2 from awsmo.getEC2Object when memoization is implemented
    this.machine = new Machine(log, awsmo, batch.ec2);
    this.machine.instanceId = instanceId;
    callback();
  }.bind(this));

  this.getPublicDNSName();
}

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

module.exports = BatchMachine;
