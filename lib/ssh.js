var resolve = require('./util').resolve;
var bash = require('bash');
var format = require('util').format;

module.exports = function SSHCommand(instance, command, callback) {
  this.instance = instance;
  this.log = instance.log.createSublogger('ssh');
  this.awsmo = instance.awsmo;
  this.command = command;

  if (this.awsmo.opts.sshKeyMappings &&
      this.awsmo.opts.sshCredentials) {
    this.sshKeyFile = this.awsmo.opts.sshKeyMappings[this.awsmo.opts.sshCredentials.awsKeyName];
    this.remoteUser = this.awsmo.opts.sshCredentials.remoteUser;
  }   

  var self = this;
  this.task = runCommand.call(this, callback);
}

function runCommand(callback) {
  var self = this;
  return this.awsmo.task(function(callback) {
    resolve([self.instance.publicDnsName,
             self.instance.instanceId,
             self.ready], 
            function(err, publicDnsName, instanceId) {
      if (err) return callback(err);

      var knownHostsFile = util.getKnownHostsFile(instanceId);

      if (!self.sshKeyFile)
        return callback(new Error("No SSH key supplied"));
      if (!self.remoteUser)
        return callback(new Error("No remote user supplied"));

      var arguments = [
        "-q",
        "-o", "UserKnownHostsFile=" + knownHostsFile,
        "-o", "StrictHostKeyChecking=no", // Assume no MITM-attack on first connection #vulnerability #fixme
        "-i", self.sshKeyFile,
        "-l", self.remoteUser,
        publicDnsName,
        bash.escape.apply(bash, self.command)
      ];

      self.log.info(bash.escape.apply(null, ['ssh'].concat(arguments)));

      var child = child_process.spawn('ssh', arguments);
      util.outputToLogger(
          this.log.createSublogger(bash.escape.apply(bash, self.command)), 
          child);
      child.stdin.end();
      var stdout = '';
      var stderr = '';
      child.stdout.on('data', function(chunk) { stdout += chunk });
      child.stderr.on('data', function(chunk) { stderr += chunk });
      child.on('exit', function (code, signal) {
        if (code) {
          var msg = util.format("command `%s` on host `%s` exited abnormally " +
                                "with code `%d`, signal `%s` and stderr:\n",
                                self.command, publicDnsName, code, signal,
                                stderr);
          var err = new Error(msg);
          err.stdout = stdout;
          err.stderr = stderr;
          err.code = code;
          err.signal = signal;
          return callback(err, stderr);
        }
        callback(null, stdout);
      });
    });
  }).then(callback || this.awsmo._catchError);
}
