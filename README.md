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
