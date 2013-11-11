var path = require('path');
var byline = require('byline');
var async = require('async');

exports.pollUntil = function (log, pollFunction, predicate, callback) {
  var interval = 10000;
  function poll() {
    log.info("Polling...");
    pollFunction(function (err) {
      var results = Array.prototype.slice.call(arguments).slice(1);
      try {
        var ok = !err && predicate.apply(null, results);
      }
      catch (err) {
        callback(err);
        return;
      }
      if (ok) {
        callback.apply(null, arguments);
      } else {
        setTimeout(poll, interval);
      }
    });
  }

  poll();
}

exports.outputToLogger = function (log, child) {
  byline(child.stdout).on('data', function (line) {
    log.info(line);
  }).setEncoding('utf8');
  byline(child.stderr).on('data', function (line) {
    log.error(line);
  }).setEncoding('utf8');
}


exports.getKnownHostsFile = function (instanceId) {
  // TODO Use ~/.awsmo/known_hosts-* instead?
  return path.join(__dirname, ".known_hosts-" + instanceId);
};

exports.resolve = function(promises, callback) {
  var callbacks = promises.map(function(promise) { return promise.then });
  async.parallel(callbacks, function(err, values) {
    if (err) return callback(err);
    values.unshift(null);
    callback.apply(this, values);
  });
};
