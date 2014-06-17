var request = require('request');
 

function getData(callback){
  request({
    uri: 'http://gsp.weathernews.jp/grpt6aa/gsp/tools/get_report_list.cgi',
    method: 'GET',
    proxy: 'http://172.16.20.214:8080',
    timeout: 10000,
    followRedirect: true,
    maxRedirects: 10
  }, function(error, response, body) {
    var obj = JSON.parse(body);
    callback(obj);
  });
}

function a(){
  getData(function(obj){
    console.log(obj);
  });
}
