var promise = require('augur');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

function Ec2Instance(awsmo, instanceId, callback) {
  EventEmitter.call(this);

  var doneFetchingOrCreating = promise();

  this.then = doneFetchingOrCreating.then;
  this.awsmo = awsmo;
  if (callback) this.then(callback);

  if (!instanceId) {
    // create new instance
  } else {
    // fetch existing instance
  }
}

inherits(Ec2Instance, EventEmitter);
