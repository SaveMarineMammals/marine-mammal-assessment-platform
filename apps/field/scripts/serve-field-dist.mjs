import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 5174);
const basePath = '/field/app';
const distDir = resolve(fileURLToPath(new URL('../dist', import.meta.url)));

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function send(res, status, body, type) {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-cache',
  });
  res.end(body);
}

function safeJoin(root, relativePath) {
  const candidate = normalize(join(root, relativePath));
  if (!candidate.startsWith(root)) {
    return null;
  }
  return candidate;
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${host}:${port}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === '/' || pathname === basePath) {
    res.writeHead(302, { location: `${basePath}/` });
    res.end();
    return;
  }

  if (!pathname.startsWith(`${basePath}/`) && pathname !== basePath) {
    send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    return;
  }

  const relative = pathname.slice(basePath.length).replace(/^\//, '');
  const filePath =
    safeJoin(distDir, relative) ??
    safeJoin(distDir, relative.length === 0 ? 'index.html' : relative);

  if (!filePath) {
    send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
    return;
  }

  let target = filePath;
  if (existsSync(target) && statSync(target).isDirectory()) {
    target = join(target, 'index.html');
  }

  if (!existsSync(target) || !statSync(target).isFile()) {
    // SPA fallback for client routes under the field base path.
    target = join(distDir, 'index.html');
  }

  if (!existsSync(target)) {
    send(res, 404, 'Field dist not found. Run pnpm build first.', 'text/plain; charset=utf-8');
    return;
  }

  const type = mime[extname(target)] ?? 'application/octet-stream';
  send(res, 200, readFileSync(target), type);
});

server.listen(port, host, () => {
  console.log(`Field dist server: http://${host}:${port}${basePath}/`);
});
