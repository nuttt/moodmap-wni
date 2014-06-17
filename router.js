function route(handle, pathname, response, postData) {
  if(typeof handle[pathname] === 'function') {
    handle[pathname](response, postData);
  } else {
    response.writeHead(404, {});
    response.end();
  }
}

exports.route = route