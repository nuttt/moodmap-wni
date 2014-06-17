var server = require('./server');
var router = require('./router');
var requestHandlers = require('./requestHandlers');
config = config.config;

var handle = {};
handle['upload'] = requestHandlers.upload;

server.start(3000, router.route, handle);