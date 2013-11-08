var async = require('async');
var augur = require('augur');
 
exports.asyncDispatcher = function() {
  return function(task) {
    var promise = augur();
    task(promise);
    return promise;
  };
};
 
exports.syncDispatcher = function() {
  var queue = async.queue(function(task, callback) {
    task.fn(task.promise);
    task.promise.then(callback);
  }, 1);
  return function(task) {
    var promise = augur();
    queue.push({
      fn: task,
      promise: promise
    }, function() {});
    return promise;
  };
};
