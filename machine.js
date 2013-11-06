var child_process = require('child_process');
var bash = require('bash');
var util = require('./util');

function Machine(log, awsmo, ec2) {
  if (!(this instanceof Machine)) return new Machine(log, awsmo, ec2);

  this.log = log;
  this.awsmo = awsmo;
  this.ec2 = ec2;
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
  util.outputToLogger(this.log.createSublogger(cmd), child);
  child.stdin.end();
  child.on('close', function (code) {
    callback(code);
  });
};

Machine.prototype.scp = function () {
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
  child.on('close', function (code) {
    callback(code);
  });
};


module.exports = Machine;
