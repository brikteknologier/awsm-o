var SSHCommand = require('./ssh');
var spawn = require('child_process').spawn;
var inherits = require('util').inherits;
var util = require('./util');
var bash = require('bash');
var resolve = util.resolve;
var format = require('util').format;

var SCP = module.exports = function SCP(instance, source, target, callback) {
  if (typeof target == 'function') {
    callback = target;
    target = '.';
  }

  if (!target) target = '.';

  this.source = source;
  this.target = target;
  
  SSHCommand.call(this, instance, null, callback);
}

inherits(SCP, SSHCommand);

SCP.prototype.run = function(callback) {
  var self = this;
  return this.awsmo.task(function(callback) {
    resolve([self.instance.publicDnsName,
             self.instance.instanceId,
             self.instance.awsKeyName,
             self.ready],
            function(err, publicDnsName, instanceId, awsKeyName) {
      if (err) return callback(err);
      runScp.call(self, publicDnsName, instanceId, awsKeyName, callback);
    });
  }).then(callback || this.awsmo._catchError);
}

function runScp(publicDnsName, instanceId, awsKeyName, callback) {
  var knownHostsFile = util.getKnownHostsFile(instanceId);
  var self = this;

  var sshKeyFile = this.awsmo.opts.sshKeyMappings[awsKeyName];
  if (!sshKeyFile)
    return callback(new Error("No SSH key supplied"));
  if (!this.remoteUser)
    return callback(new Error("No remote user supplied"));

 
  var args = [
    "-o", "UserKnownHostsFile=" + knownHostsFile,
    "-o", "StrictHostKeyChecking=no", // Assume no MITM-attack on first connection #vulnerability #fixme
    "-i", sshKeyFile,
    this.source,
    this.remoteUser + '@' + publicDnsName + ':' + this.target
  ];

  this.log.info(bash.escape.apply(null, ['scp'].concat(args)));

  var child = spawn('scp', args);
  util.outputToLogger(this.log, child);
  child.stdin.end();
  var stdout = '';
  var stderr = '';
  child.stdout.on('data', function(chunk) { stdout += chunk });
  child.stderr.on('data', function(chunk) { stderr += chunk });
  child.on('exit', function (code, signal) {
    if (code) {
      var msg = format("scp of `%s` -> `%s` on host `%s` exited abnormally " +
                        "with code `%d`, signal `%s` and stderr:\n",
                        self.source, self.target, publicDnsName, code, 
                        signal, stderr);
      var err = new Error(msg);
      err.stdout = stdout;
      err.stderr = stderr;
      err.code = code;
      err.signal = signal;
      return callback(err, stderr);
    }
    callback(null, stdout);
  });
}
