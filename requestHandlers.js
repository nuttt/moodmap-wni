var net = require('net');
var flume = require('./flume');

function upload(response, postData) {

  response.writeHead(200, {});
  response.end();

}
  

exports.upload = upload;