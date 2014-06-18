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
server.get('/info/:level/:id', info);
server.get('/report/:id', report);

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

/*
 * For http://localhost:8080/info/{level}/{id}
 * level 2 => country
 * level 1 => city/state
 * level 0 => individual report
 */
function info(req, res, next) {
  var level = req.params.level;
  var id = req.params.id;
  getData(function(reports){
    var output;
    if(level == '2'){
      res.send(infoCountry(reports,id));
      return next();
    }
    else if(level == '1'){
      infoCity(reports,id,function(result){
        res.send(result);
        return next();
      });
    }
    else if(level == '0'){
      res.send({});
      return next();
    }
    else{
      res.send({});
      return next();
    }
  });
}

/*
 * For http://localhost:8080/report/{id}
 * id is repoid
 */
function report(req, res, next) {
  var id = req.params.id;
  getData(function(reports){
    res.send(getReport(reports,id));
    return next();
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
  }
  return output;
}

function infoCountry(reports, cc){
  if(cc != ''){
    var filteredReports = _.filter(reports, function(report){ return report.cc == cc; });
    var moodArray = getMoodArray(filteredReports);
    var thumbArray = getThumbArray(filteredReports);
    console.log({
      'id': cc,
      'name': getCountryName(cc),
      'moods': moodArray,
      'level': 2,
      'top_photo_thumbnails': thumbArray,
    });
    return {
      'id': cc,
      'name': getCountryName(cc),
      'moods': moodArray,
      'level': 2,
      'top_photo_thumbnails': thumbArray,
    };
  }
  else{
    return null;
  }
}

function infoCity(reports, city, callback){
  if(city != ''){
    var filteredReports = _.filter(reports, function(report){ return report.location == city; });
    var moodArray = getMoodArray(filteredReports);
    var thumbArray = getThumbArray(filteredReports);
    getCityName(city, function(cityName){
      callback({
        'id': city,
        'name': cityName,
        'moods': moodArray,
        'level': 1,
        'top_photo_thumbnails': thumbArray,
      });

    });
  }
  else{
    callback(null);
  }
}

function getReport(reports,repoid){
  report = _.find(reports, function(rep){ return rep.repoid == repoid; });
  if(report){
    return {
      id: report.repoid,
      photo_url: report.photo,
      name: report.name,
      note: report.skytag
    };
  }
}

/*
 * Return top five commented reports
 */
function getThumbArray(reports){
  reports.sort(function(a,b){ return a.ncomments - b.ncomments; }).reverse();
  reports = reports.slice(0,10);
  reportsArray = _.map(reports, function(val, key){
    return {
      'id': val.repoid,
      'thumbnail_url': val.thumb
    }
  });
  return reportsArray;
}

/*
 * Return top three moods
 */
function getMoodArray(reports){
  var moodNum = 0;
  var moodCount = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0
  };
  for(i in reports){
    if(reports[i].skyfeel){
      moodNum += 1;
      moodCount[reports[i].skyfeel] += 1;
    }
  }
  if(moodNum > 0){
    var moodArray = [
      {mood_level: 1, mood_percent: toPercentDecimal(moodCount[1],moodNum)},
      {mood_level: 2, mood_percent: toPercentDecimal(moodCount[2],moodNum)},
      {mood_level: 3, mood_percent: toPercentDecimal(moodCount[3],moodNum)},
      {mood_level: 4, mood_percent: toPercentDecimal(moodCount[4],moodNum)},
      {mood_level: 5, mood_percent: toPercentDecimal(moodCount[5],moodNum)},
    ];
    moodArray.sort(function(a,b){ return a.mood_percent - b.mood_percent; });
    moodArray.reverse();
    moodArray = moodArray.slice(0,3);
    return moodArray;
  }
  else{
    moodArray = null;
  }
}

/*
 * Calculate rounded percentage
 */
function toPercentDecimal(num, sum){
  if(sum > 0) return Math.round((num/sum)*100);
  return null;
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
 * Find city name in the db
 * If the name is not found, return the input
 */
function getCityName(cityName, callback){
  db.find({id: cityName}, function(err, docs){
    if(docs.length > 0)
      callback(docs[0].name);
    else 
      callback(cityName);
  });
}

/*
 * Find country name from cc (country code)
 * If the name is not found, return cc
 */
function getCountryName(cc){
  if(countries.list[cc])
    return countries.list[cc].name
  else
    return cc
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
