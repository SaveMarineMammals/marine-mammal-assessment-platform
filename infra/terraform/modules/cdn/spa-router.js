function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri.indexOf('/v1/') === 0 || uri.indexOf('/openapi') === 0) {
    return request;
  }

  // Pass through real assets (have a file extension in the last path segment).
  if (/\/[^/]+\.[^/]+$/.test(uri)) {
    return request;
  }

  if (uri === '/field/app' || uri.indexOf('/field/app/') === 0) {
    request.uri = '/field/app/index.html';
    return request;
  }

  request.uri = '/index.html';
  return request;
}
