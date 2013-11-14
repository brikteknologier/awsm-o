AWSM-O
======
I am AWSM-O (**aw**-s *uh* m oh)! (Amazon Web Services... and then M-O, to make
it similar to AWESOM-O)

![I am AWESOM-O!](http://i.imgur.com/Aggwojh.jpg)

I help automate working with EC2 instances from node.js. I'm a bit more friendly
than amazon's AWS api.

## example

```javascript
var awsmo = require('awsm-o')({
  awsCredentials: './credentials.csv',
  region: 'eu-west-1',
  sshCredentials: {
    awsKeyName: 'amazon_key',
    remoteUser: 'ubuntu'
  },
  sshKeyMappings: {
    amazon_key: './amazon_key.pem'
  } 
});

var instance = awsmo.getInstance('i-4b23f59e', function(err, instance) {
  instance.ssh(['ifconfig'], function(err, output) {
    console.log('ifconfig from i-4b23f59e:');
    console.log(output);
  });
});
```

## install

```
npm i --save awsm-o
```

## documentation

### `AwsmO(options)`

Creates a new instance of AwsmO. Options are:

* `awsCredentials` __(required)__ - either a path to your aws credentials csv
  file, or an object with an `accessKeyId` and a `secretAccessKey`.
* `region` __(required)__ - your AWS region string, i.e. `'us-west-1'`. 
* `sshKeyMappings` __(required if using ssh/scp/creating an instance)__ - an 
  object where each key represents the name of an ssh key used by EC2, and the
  value is the location of that key on disk (relative to process.cwd()). The key
  names need to align with EC2 in order to assign the correct key when creating an
  instance. i.e `{ myprivatekey: '/home/jon/.ssh/myprivatekey.pem' }`. 
* `sshCredentials` - the default SSH credentials for an instance to use when
  attempting to connect with SSH. Should be an object with a `remoteUser` and
  an `awsKeyName` that refers to a key in `sshKeyMappings`. i.e.
  `{ remoteUser: 'ubuntu', awsKeyName: 'myprivatekey' }`
* `sequential` (default = false) - if set to true, only one command will be
  executed at a time. See [sequential mode](#sequential-mode) for more details.
* `pollDelay` (default = 10000) - the default interval when polling an instance
  for changes. in milliseconds.
* `log` (default = none) - the logger to use. should be a 
  [TaggedLogger](http://bitbucket.org/maghoff/tagged-logger)

#### `awsmo.getInstance(instanceId [, callback])`

Returns a new Ec2Instance object, with the given instanceId.

#### `awsmo.createInstance(opts [, callback])`

Returns a new Ec2Instance object, using the given options to create it. Options
are: 

* `name` (default = `'AWSM-O instance'`) - the name to give the instance. 
* `imageId` __(required)__ - the AMI ID to create this instance with.
  i.e. `'ami-12345678'`
* `key` __(required)__ - name of the private key to use i.e. `'myprivatekey'`
* `securityGroupIds' __(required)__ - security groups that this instance should
  belong to (array). i.e. `['sg-12345678', 'sg-45678901']`
* `instanceType` (default = `'t1.micro'`) - type of instance to create
* `availabilityZone` (default = `'eu-west-1'`) - availability zone to create the
  instance in.

### Ec2Instance

Represents an EC2 instance. To get an Ec2Instance object you need to call either
`awsmo.getInstance` or `awsmo.createInstance`.

#### `ec2instance.getState(callback)`

Fetch the state of the instance.

* `callback(err, state)` - callback to call when the state is retrieved. `state`
  is a string representing the current state, i.e. 'pending', 'running',
  'stopping', 'stopped', 'terminated', etc.

Example:

```javascript
var inst = awsmo.getInstance('i-12345787');
inst.getState(function(err, state) {
  console.log(state); // -> 'running'
});
```

#### `ec2instance.setName(name, callback)`

Set the name of an instance.

* `name` - the name to set on the instance.
* `callback(err)` - called once the name has been set.

#### `ec2instance.publicDnsName`

A promise of the publicDnsName for this instance. Should only be used if you know
the instance should have, or is about to receive, a public dns name.

You can use it like a regular `getPublicDnsName` function by calling 
`instance.publicDnsName.then(function(err, publicDnsName) { ...`.

#### `start(callback)`, `stop(callback)`, `reboot(callback)`, `terminate(callback)`

Lifecycle functions. Each one will perform the requested function, and callback
once the desired state has been achieved. For example, calling `instance.stop()`
will not call back until the instance has a state of `'stopped'`.

#### `ec2instance.ssh(command, callback)`

Run an command on the remote instance.

* `command` an array with each part of the command to run. for example, 
  `['ifconfig', 'eth0']`
* `callback(err, output)` callback to be called once the command has been run.
  `output` is a string with the stdout of the process. 

#### `ec2instance.scp(from, [to ,] callback)`

Copy a file to the instance.

* `from` path to the file to copy (relative to the cwd).
* `to` (default = `'.'`) where to copy the file on the instance
* `callback(err, output)` callback to be called when the scp operation is
  complete. 

#### `ec2instance.createAmi(name, description, callback)`

Create an AMI from this instance.

* `name` the name of the AMI. If the name is taken, a number is added at the end
  and incremented until a name is found that is not taken.
* `description` the description of the AMI.
* `callback(err, amiId)` callback to be called when the ami has been created. 

<a name="sequential-mode"/>
## Sequential Mode

Normally, you can use awsm-o like any other node library, with nested callbacks
to manage control flow, like this:

```javascript
var instance = awsmo.createInstance(..., function(err) {
  instance.scp('./setup.sh', function(err) {
    instance.ssh(['./setup.sh'], function(err) {
      instance.createAmi('my amazing ami', 'its super amazing', function(err, amiid) {
        instance.terminate();
      });
    });
  });
});
```

Not that you would ever write code like that, but you get the point. For cases
such as this, we have sequential mode.

If `sequential` option in the awsmo constructor is set to `true`, then we 
can just do this:

```javascript
var instance = awsmo.createInstance(...);
instance.scp('./setup.sh');
instance.ssh(['./setup.sh']);
instance.createAmi('my amazing ami', 'its super amazing', function(err, amiId) {
  // I got an amiId!
});
instance.terminate();
```

Only one operation is run at a time, and each operation will automatically wait 
for those before it to finish before running. The operation queue is contained
inside awsmo, not each instance, so it will work over many instance objects assign
well. If you want to have two simultaneous sequential modes, you'd have to create 
two awsmo instances.
