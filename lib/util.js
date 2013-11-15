var path = require('path');
var byline = require('byline');
var async = require('async');

exports.outputToLogger = function (log, child) {
  byline(child.stdout).on('data', function (line) {
    log.info(line);
  }).setEncoding('utf8');
  byline(child.stderr).on('data', function (line) {
    log.error(line);
  }).setEncoding('utf8');
}

exports.getKnownHostsFile = function (instanceId) {
  return path.normalize(path.join(__dirname, '..', ".known_hosts-" + instanceId));
};

exports.resolve = function(promises, callback) {
  var callbacks = promises.map(function(promise) { return promise.then });
  async.parallel(callbacks, function(err, values) {
    if (err) return callback(err);
    values.unshift(null);
    callback.apply(this, values);
  });
};
