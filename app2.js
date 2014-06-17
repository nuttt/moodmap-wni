var request = require('request');
var restify = require('restify');
var countries = require('./db/countries');
var _ = require('underscore');

/* Create Server */
/* http://localhost:8080 */
var server = restify.createServer();
server.listen(8080);

/* Routes */
server.get('/location/:level', location);

/* 
 * For http://localhost:8080/location/{level} 
 * level 2 => country
 * level 1 => city/state
 * level 0 => individual report
 */
function location(req, res, next) {
  var level = req.params.level;
  getData(function(reports){
    var output;
    switch(level){
      case '2':
        output = locationCountry(reports);
        break;
      case '1':
        output = locationCity(reports);
        break;
    }

    res.send(output);
    return next();
  });
  // res.send('hello ' + req.params.level);
}
function locationCountry(reports){
  var output = [];
  var groupedObjs = _.groupBy(reports, 'cc');
  for(cc in groupedObjs){
    if(cc != ''){
      console.log(countries.list[cc]['name']);
      var mood_num = 0;
      var mood_sum = 0;
      var mood_avg = null;
      for(i in groupedObjs[cc]){
        if(groupedObjs[cc][i].skyfeel){
          mood_num += 1;
          mood_sum += parseInt(groupedObjs[cc][i].skyfeel);
        }
      }
      if(mood_num > 0) mood_avg = Math.round(mood_sum/mood_num);
      output.push({
        'id': cc,
        'name': countries.list[cc]['name'],
        'lat': countries.list[cc]['lat'],
        'lon': countries.list[cc]['lon'],
        'mood': mood_avg,
        'level': 2,
      });
    }
  }
  return output;
}
function locationCity(reports){
  var output = [];
  var groupedObjs = _.groupBy(reports, 'location');
  for(city in groupedObjs){
    if(city != ''){
      // console.log(countries.list[city]);
      var mood_num = 0;
      var mood_sum = 0;
      var mood_avg = null;
      for(i in groupedObjs[city]){
        if(groupedObjs[city][i].skyfeel){
          mood_num += 1;
          mood_sum += parseInt(groupedObjs[city][i].skyfeel);
        }
      }
      if(mood_num > 0) mood_avg = Math.round(mood_sum/mood_num);
      output.push({
        'id': city,
        'name': city,
        'mood': mood_avg,
        'level': 1,
      });
    }
  }
  return output;
}

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
