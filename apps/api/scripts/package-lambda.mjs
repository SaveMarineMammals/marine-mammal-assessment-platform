import { mkdirSync, rmSync, writeFileSync, readFileSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import esbuild from 'esbuild';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, '..');
const repoRoot = join(apiRoot, '..', '..');
const outDir = join(apiRoot, 'dist-lambda');
const zipPath = join(apiRoot, 'dist', 'api-lambda.zip');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
mkdirSync(dirname(zipPath), { recursive: true });

await esbuild.build({
  entryPoints: [join(apiRoot, 'src/lambda.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: join(outDir, 'lambda.mjs'),
  sourcemap: false,
  banner: {
    // Bundled CJS deps (pino, @fastify/swagger-ui) still reference __dirname/require.
    js: [
      "import { createRequire as __createRequire } from 'module';",
      "import { fileURLToPath as __fileURLToPath } from 'url';",
      "import { dirname as __dirnameOf } from 'path';",
      'const require = __createRequire(import.meta.url);',
      'const __filename = __fileURLToPath(import.meta.url);',
      'const __dirname = __dirnameOf(__filename);',
    ].join(''),
  },
  // Keep native pg optional bindings external if present; pure JS works for RDS TLS.
  external: ['pg-native'],
});

// Include SQL migrations next to the bundle for runMigrations().
const migrationsSrc = join(apiRoot, 'migrations');
const migrationsDest = join(outDir, 'migrations');
if (existsSync(migrationsSrc)) {
  cpSync(migrationsSrc, migrationsDest, { recursive: true });
}

// Swagger UI reads logo/static via __dirname; after bundling that is LAMBDA_TASK_ROOT.
const swaggerUiPkg = require.resolve('@fastify/swagger-ui/package.json', { paths: [apiRoot] });
const swaggerUiStatic = join(dirname(swaggerUiPkg), 'static');
cpSync(swaggerUiStatic, join(outDir, 'static'), { recursive: true });

writeFileSync(
  join(outDir, 'package.json'),
  `${JSON.stringify({ type: 'module', main: 'lambda.mjs' }, null, 2)}\n`,
);

const archiverPath = [
  join(repoRoot, 'node_modules/archiver'),
  join(apiRoot, 'node_modules/archiver'),
].find((candidate) => existsSync(candidate));

if (archiverPath) {
  const archiver = require(archiverPath);
  const { createWriteStream } = await import('node:fs');
  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(outDir, false);
    archive.finalize();
  });
} else {
  // Prefer system zip on CI/Linux; PowerShell Compress-Archive on Windows.
  try {
    execFileSync('zip', ['-r', zipPath, '.'], { cwd: outDir, stdio: 'inherit' });
  } catch {
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${outDir}\\*' -DestinationPath '${zipPath}' -Force`,
      ],
      { stdio: 'inherit' },
    );
  }
}

const bytes = readFileSync(zipPath).byteLength;
console.log(`Wrote ${zipPath} (${bytes} bytes)`);

// Catch ESM/CJS bundling regressions (e.g. missing __dirname) before deploy.
process.env.LAMBDA_TASK_ROOT = outDir;
delete process.env.DATABASE_URL;
const { pathToFileURL } = await import('node:url');
const { handler } = await import(pathToFileURL(join(outDir, 'lambda.mjs')).href);
const smoke = await handler(
  {
    version: '2.0',
    routeKey: 'GET /v1/health',
    rawPath: '/v1/health',
    headers: { host: 'localhost' },
    requestContext: {
      http: {
        method: 'GET',
        path: '/v1/health',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'package-lambda-smoke',
      },
    },
    isBase64Encoded: false,
  },
  {
    awsRequestId: 'package-lambda-smoke',
    getRemainingTimeInMillis: () => 30_000,
    callbackWaitsForEmptyEventLoop: false,
  },
);
if (!smoke || smoke.statusCode !== 200) {
  throw new Error(`Lambda package smoke failed: ${JSON.stringify(smoke)}`);
}
console.log('Lambda package smoke OK (GET /v1/health)');
