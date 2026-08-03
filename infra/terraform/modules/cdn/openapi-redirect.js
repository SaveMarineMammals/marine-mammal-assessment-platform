function handler(event) {
  var request = event.request;
  var hostHeader = request.headers.host && request.headers.host.value;
  var host = hostHeader ? hostHeader.split(':')[0] : '';
  var uri = request.uri;
  // Legacy public path → API Swagger UI (and its /static assets under the new prefix).
  var targetPath = '/api/docs' + uri.substring('/openapi'.length);

  var params = [];
  for (var key in request.querystring) {
    if (Object.prototype.hasOwnProperty.call(request.querystring, key)) {
      var qsEntry = request.querystring[key];
      if (qsEntry.multiValue) {
        for (var i = 0; i < qsEntry.multiValue.length; i++) {
          params.push(key + '=' + qsEntry.multiValue[i].value);
        }
      } else {
        params.push(key + '=' + qsEntry.value);
      }
    }
  }
  var queryString = params.length > 0 ? '?' + params.join('&') : '';

  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: { value: 'https://' + host + targetPath + queryString },
    },
  };
}
