import { createServer, request as httpRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173),
  apiPort = Number(process.env.WEBSITE_BUILDER_API_PORT || 4174),
  componentPort = Number(process.env.WEBSITE_BUILDER_COMPONENT_PORT || 4175);
if (
  [port, apiPort, componentPort].some((p) => !Number.isInteger(p) || p < 1 || p > 65535) ||
  new Set([port, apiPort, componentPort]).size !== 3
)
  throw new Error('Choose distinct valid frontend, API and component preview ports.');
const candidates = [
  process.env.WEBSITE_BUILDER_PYTHON,
  resolve(root, '.venv/bin/python'),
  resolve(root, '../pixelcore-platform/pixelcore-backend/venv/bin/python'),
];
const python = [...candidates, 'python3', 'python'].find(
  (p) => p && spawnSync(p, ['-c', 'import django'], { stdio: 'ignore' }).status === 0,
);
if (!python)
  throw new Error(
    'Set WEBSITE_BUILDER_PYTHON to a Python environment with Django installed. See README.md for setup.',
  );
const env = {
  ...process.env,
  PYTHONPATH: [resolve(root, 'python'), resolve(root, 'studio/server'), process.env.PYTHONPATH]
    .filter(Boolean)
    .join(sep === '\\' ? ';' : ':'),
  DJANGO_SETTINGS_MODULE: 'component_lab.settings',
  WEBSITE_BUILDER_FRONTEND_URL: `http://localhost:${port}`,
  WEBSITE_BUILDER_COMPONENT_ORIGIN: `http://localhost:${componentPort}`,
};
const migrate = spawnSync(python, ['-m', 'django', 'migrate', '--noinput'], {
  cwd: root,
  env,
  stdio: 'inherit',
});
if (migrate.status !== 0) process.exit(migrate.status || 1);
const api = spawn(python, ['-m', 'django', 'runserver', `127.0.0.1:${apiPort}`, '--noreload'], {
  cwd: root,
  env,
  stdio: 'inherit',
});
const types = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.html': 'text/html',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};
const server = createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const upstream = httpRequest(
      {
        host: '127.0.0.1',
        port: apiPort,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `localhost:${port}` },
      },
      (response) => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      },
    );
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(503, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          error: {
            code: 'API_STARTING',
            message: 'The local API is starting. Try again in a moment.',
          },
        }),
      );
    });
    req.pipe(upstream);
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const normalizedPath = pathname.replace(/\/$/, '') || '/';
    const missingStudioRoute =
      /^\/studio(?:\/[a-zA-Z0-9_-]+)*\/?$/.test(pathname) &&
      !pathname.startsWith('/studio/web') &&
      !pathname.startsWith('/studio/server') &&
      ![
        '/studio',
        '/studio/builder',
        '/studio/settings',
        '/studio/analytics',
        '/studio/components',
      ].includes(normalizedPath);
    let path = missingStudioRoute
      ? resolve(root, 'studio/web/index.html')
      : [
            '/',
            '/login',
            '/studio',
            '/studio/builder',
            '/studio/analytics',
            '/studio/settings',
            '/studio/components',
          ].includes(pathname.replace(/\/$/, '') || '/')
        ? resolve(root, 'studio/web/index.html')
        : ['/', '/website-review', '/published'].includes(pathname)
          ? resolve(root, 'examples/index.html')
          : pathname.startsWith('/assets/')
            ? resolve(root, 'examples', pathname.slice(1))
            : resolve(root, '.' + pathname);
    const relative = path.slice(root.length + 1);
    if (
      !path.startsWith(root + sep) ||
      !['packages/', 'examples/', 'studio/web/'].some((prefix) => relative.startsWith(prefix))
    ) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    if (!(await stat(path)).isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(missingStudioRoute ? 404 : 200, {
      'content-type': types[extname(path)] || 'application/octet-stream',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
const componentServer = createServer((req, res) => {
  if (req.method !== 'GET' || !req.url.startsWith('/components/')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const upstream = httpRequest(
    {
      host: '127.0.0.1',
      port: apiPort,
      path: '/api/studio/runtime/' + req.url.slice('/components/'.length),
      method: 'GET',
      headers: { host: `localhost:${apiPort}` },
    },
    (response) => {
      const headers = { ...response.headers };
      delete headers['set-cookie'];
      res.writeHead(response.statusCode, headers);
      response.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(503);
    res.end('The component preview service is starting.');
  });
  upstream.end();
});
componentServer.on('error', (error) => {
  console.error(error.message);
  close();
});
componentServer.listen(componentPort, '127.0.0.1');
let closing = false;
function close() {
  if (closing) return;
  closing = true;
  api.kill('SIGTERM');
  componentServer.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
api.on('exit', (code) => {
  if (!closing && code !== 0) {
    console.error('The API stopped.');
    close();
  }
});
server.on('error', (error) => {
  console.error(error.message);
  close();
});
server.listen(port, '127.0.0.1', () =>
  console.log(
    `Website studio: http://localhost:${port}\nComponent Lab: http://localhost:${port}/studio/components\nPublished example: http://localhost:${port}/published\nExample data is labeled and isolated from host databases.`,
  ),
);
