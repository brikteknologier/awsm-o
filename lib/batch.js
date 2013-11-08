var async = require('async');
var BatchMachine = require('./batch-machine');

function Batch(log, awsmo) {
  if (!(this instanceof Batch)) return new Batch(log, awsmo);

  this.log = log;
  this.awsmo = awsmo;
  this.sequence = [];
}

Batch.prototype.Machine = function () {
  return new BatchMachine(this.log, this.awsmo, this);
};

Batch.prototype.execute = function (callback) {
  this.awsmo.getEC2Object(function (err, ec2) {
    this.ec2 = ec2;
    async.series(this.sequence, callback);
  }.bind(this));
};

module.exports = Batch;
