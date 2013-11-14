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

#### 'awsmo.createInstance(opts [, callback])`

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

