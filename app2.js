var request   = require('request'),
    restify   = require('restify'),
    countries = require('./db/countries'),
    async     = require('async'),
    _         = require('underscore'),
    Datastore = require('nedb'), 
    db        = new Datastore({ filename: './db/cities.db', autoload: true });

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
    if(level == '2'){
      res.send(locationCountry(reports));
      return next();
    }
    else if(level == '1'){
      locationCity(reports, function(out){
        output = out;
        res.send(output);
        return next();
      });
    }
    else if(level == '0'){
      res.send(locationReport(reports));
      return next();
    }
    else{
      res.send([]);
      return next();
    }
  });
}
function locationCountry(reports){
  var output = [];
  var groupedObjs = _.groupBy(reports, 'cc');
  for(cc in groupedObjs){
    if(cc != ''){
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
      if(mood_avg && countries.list[cc]['lat'] && countries.list[cc]['lon'])
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
function locationCity(reports, callbackLocation){
  var output = [];
  var groupedObjs = _.groupBy(reports, 'location');
  var cityList = _.keys(groupedObjs);
  async.eachSeries(cityList,function(city, callback){
    if(city != ''){
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
      getCityLatLong(city, function(result){
        if(mood_avg && result.lat && result.lon)
          output.push({
            'id': city,
            'name': result.name,
            'lat': result.lat,
            'lon': result.lon,
            'mood': mood_avg,
            'level': 1,
          });
        callback();
      });
    } 
    else {
      callback();
    }
  }, function(){
    callbackLocation(output);
  });
}
function locationReport(reports){
  var output = [];
  for(i in reports){
    if(reports[i].skyfeel && reports[i].lat != '0.000000' && reports[i].lon != '0.000000'){
      output.push({
        'id': reports[i].repoid,
        'name': reports[i].name+" @ "+reports[i].location,
        'lat': reports[i].lat,
        'lon': reports[i].lon,
        'mood': reports[i].skyfeel,
        'level': 0
      });
    }
    // else{
    //   console.log(reports[i]);
    // }
  }
  return output;
}
/*
 * Try to get a lat/lon from the database, 
 * and send a request if not found
 */
function getCityLatLong(cityName, callback){
  db.find({id: cityName}, function(err, docs){
    if(docs.length > 0){
      callback(docs[0]);
    }
    else{
      requestCityAndInsert(cityName, function(item){
      console.log('inserted');
      console.log(item);
        callback(item);
      });
    }
  });
}
/*
 * Send a request to openstreetmap to ask 
 * for lat/lon and save it to the database
 */
function requestCityAndInsert(cityName, callback){
  request({
    uri: urlForGeocode(cityName),
    method: 'GET',
    proxy: 'http://172.16.20.214:8080',
    timeout: 10000,
    followRedirect: true,
    maxRedirects: 10
  }, function(error, response, body) {
    var obj = JSON.parse(body);
    if(obj.length > 0){
      newItem = {
        id: cityName,
        name: obj[0].display_name,
        lat: obj[0].lat,
        lon: obj[0].lon
      };
    } 
    else{
      newItem = {
        id: cityName,
        name: cityName,
        lat: null,
        lon: null
      };
    }
    db.insert(newItem, function (err, newDoc) {
      callback(newDoc);
    });
  });
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
function urlForReverseGeocode (lat, lng) {
  return "http://nominatim.openstreetmap.org/reverse?lat=" + lat +"&lon=" + lng + "&accept-language=en-us&format=json&zoom=18";
}
function urlForGeocode (str) {
  return "http://nominatim.openstreetmap.org/search?q="+ str +"&format=json&accept-language=en-us&limit=1"
}

function a(){
  getData(function(obj){
    console.log(obj);
  });
}
