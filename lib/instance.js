var promise = require('augur');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

function Ec2Instance(awsmo, callback) {
  EventEmitter.call(this);

  var doneFetchingOrCreating = promise();

  this.then = doneFetchingOrCreating.then;
  this.awsmo = awsmo;
  if (callback) this.then(callback);
}

inherits(Ec2Instance, EventEmitter);
module.exports = {
  create: createEC2Instance,
  get: getEC2Instance
};

function createEC2Instance(instance, callback) {
  // TODO Validate input

  ec2.runInstances({
    ImageId: spec.imageId,
    MinCount: 1,
    MaxCount: 1,
    KeyName: spec.key,
    SecurityGroupIds: spec.securityGroupIds,
    InstanceType: spec.instanceType || "t1.micro",
    Placement: {
      AvailabilityZone: "eu-west-1b"
    }
  }, function (err, data) {
    if (err) return callback(err);

    var instanceId = data.Instances[0].InstanceId;
    ec2.createTags({
      Resources: [ instanceId ],
      Tags: [
        {
          Key: "Name",
          Value: spec.name || "AWSM-O instance"
        }
      ]
    }, function (err, nameData) {
      callback(err, data);
    });
  });
}
