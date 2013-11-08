var csv = require('csv');

module.exports = function (filename, callback) {
  csv()
    .from.path(filename)
    .to.array(function (data) {
      if (data.length !== 2 || data[1].length !== 3) {
        return callback(new Error("The given file does not look like an AWS credentials.csv"));
      }
      callback(null, {
        "accessKeyId": data[1][1],
        "secretAccessKey": data[1][2]
      });
    });
};
