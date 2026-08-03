function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Match local nginx/Vite: /openapi → /docs (API Swagger UI routePrefix).
  if (uri.indexOf('/openapi') === 0) {
    request.uri = '/docs' + uri.substring(8);
  }

  return request;
}
