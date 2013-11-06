var child_process = require('child_process');
var async = require('async');
var bash = require('bash');
var util = require('./util');

function Machine(log, awsmo, ec2, instanceId) {
  if (!(this instanceof Machine)) return new Machine(log, awsmo, ec2, instanceId);

  this.log = log;
  this.awsmo = awsmo;
  this.ec2 = ec2;
  this.instanceId = instanceId;
}

Machine.prototype.pollForPublicDnsName = function (callback) {
  util.pollUntil(
    this.log.createSublogger("pollForPublicDnsName"),
    function (callback) {
      this.ec2.describeInstances({ InstanceIds: [ this.instanceId ] }, callback);
    }.bind(this),
    function (data) {
      var state = data.Reservations[0].Instances[0].State.Name;
      if (state !== 'pending' && state !== 'running') {
        throw new Error("Invalid state. Will never get PublicDNSName");
      }
      var publicDnsName = data.Reservations[0].Instances[0].PublicDnsName;
      return !!publicDnsName;
    },
    function (err, data) {
      if (!err) {
        this.publicDnsName = data.Reservations[0].Instances[0].PublicDnsName;
      }
      callback(err);
    }.bind(this)
  );
};

Machine.prototype.pollForSshAccess = function (callback) {
  util.pollUntil(
    this.log.createSublogger("pollUntilSshAccess"),
    function (callback) {
      this.ssh(["true"], callback);
    }.bind(this),
    function () {
      return true;
    },
    callback
  );
};

Machine.prototype.pollUntilState = function (state, callback) {
  util.pollUntil(
    this.log.createSublogger('pollUntilState(' + JSON.stringify(state) + ')'),
    function (callback) {
      this.ec2.describeInstances({ InstanceIds: [ this.instanceId ] }, callback);
    }.bind(this),
    function (data) {
      return data.Reservations[0].Instances[0].State.Name === state;
    },
    function (err, data) {
      delete this.publicDnsName;
      callback(err);
    }.bind(this)
  );
};

Machine.prototype.ssh = function (cmd, callback) {
  // TODO Assert state
  var knownHostsFile = util.getKnownHostsFile(this.instanceId);
  var sshKeyFile = this.awsmo.sshKeyMappings[this.sshCredentials.awsKeyName];
  var remoteUser = this.sshCredentials.remoteUser;
  var publicDnsName = this.publicDnsName;

  var sshExecutable = "/usr/bin/ssh";
  var arguments = [
    "-q",
    "-o", "UserKnownHostsFile=" + knownHostsFile,
    "-o", "StrictHostKeyChecking=no", // Assume no MITM-attack on first connection #vulnerability #fixme
    "-i", sshKeyFile,
    "-l", remoteUser,
    publicDnsName,
    bash.escape.apply(bash, cmd)
  ];

  this.log.info(bash.escape.apply(null, [sshExecutable].concat(arguments)));

  var child = child_process.spawn(sshExecutable, arguments);
  util.outputToLogger(this.log.createSublogger(bash.escape.apply(bash, cmd)), child);
  child.stdin.end();
  child.on('exit', function (code, signal) {
    // TODO Handle this better:
    // Make a descriptive new Error(<stuff>) if the exit was not OK
    callback(code);
  });
};

Machine.prototype.scp = function (/* source, [target], callback */) {
  var source, target, callback;
  if (arguments.length === 2) {
    source = arguments[0];
    target = ".";
    callback = arguments[1];
  } else {
    source = arguments[0];
    target = arguments[1];
    callback = arguments[2];
  }

  // TODO Assert state

  var knownHostsFile = util.getKnownHostsFile(this.instanceId);
  var sshKeyFile = this.awsmo.sshKeyMappings[this.sshCredentials.awsKeyName];
  var remoteUser = this.sshCredentials.remoteUser;
  var publicDnsName = this.publicDnsName;

  var scpExecutable = "/usr/bin/scp";
  var arguments = [
    "-o", "UserKnownHostsFile=" + knownHostsFile,
    "-o", "StrictHostKeyChecking=no", // Assume no MITM-attack on first connection #vulnerability #fixme
    "-i", sshKeyFile,
    source,
    remoteUser + "@" + publicDnsName + ":" + target // TODO: escaping of sorts?
  ];

  this.log.info(bash.escape.apply(null, [scpExecutable].concat(arguments)));

  var child = child_process.spawn(scpExecutable, arguments);
  util.outputToLogger(this.log, child);
  child.stdin.end();
  child.on('exit', function (code) {
    // TODO Handle this better, like for ssh above
    callback(code);
  });
};

Machine.prototype.powerOff = function (callback) {
  async.series([
    this.ssh.bind(this, ['sudo', 'poweroff']),
    this.pollUntilState.bind(this, "stopped")
  ],
    callback
  );
};

Machine.prototype.terminate = function (callback) {
  this.ec2.terminateInstances({
    InstanceIds: [ this.instanceId ]
  }, function (err, data) {
    callback(err);
  });
};

Machine.prototype.createAmi = function (baseName, amiDescription, callback) {
  var suffix = 1;
  var createImageCallback = function (err, data) {
    if (err) {
      if (err.code === "InvalidAMIName.Duplicate") {
        return createImage(baseName + " " + (++suffix), createImageCallback);
      }
      return callback(err);
    }
    var imageId = data.ImageId;
    this.log.info("Created AMI " + imageId);
    callback(null, imageId);
  }.bind(this);

  var createImage = function (name, callback) {
    this.ec2.createImage({
      InstanceId: this.instanceId,
      Name: name,
      Description: amiDescription
    }, createImageCallback);
  }.bind(this);

  createImage(baseName, createImageCallback);
};


module.exports = Machine;
