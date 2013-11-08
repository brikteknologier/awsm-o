var promise = require('augur');

function Ec2Instance(awsmo, instanceId, callback) {
  var doneFetchingOrCreating = promise();

  if (!instanceId) {
    // create new instance
  } else {
    // fetch existing instance
  }

  this.then = doneFetchingOrCreating.then;
  if (callback) this.then(callback);
}
