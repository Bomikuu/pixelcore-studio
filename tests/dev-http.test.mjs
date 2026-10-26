import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { createDocument } from '../packages/core/src/index.js';
const unusedPort = () =>
  new Promise((resolve) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
test(
  'local dev command migrates an isolated database and serves saved reviews',
  { timeout: 30000 },
  async (t) => {
    const port = await unusedPort(),
      apiPort = await unusedPort(),
      componentPort = await unusedPort(),
      dataDir = await mkdtemp(join(tmpdir(), 'website-builder-http-'));
    const hostPort = await unusedPort();
    let revoked = false;
    const platformServer = createHttpServer(async (req, res) => {
      try {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        const value = JSON.parse(raw);
        const secret = (await readFile(join(dataDir, 'platform-client.key'), 'utf8')).trim();
        assert.ok(
          req.headers['x-studio-client'] === secret,
          'The server exchange must authenticate its configured client.',
        );
        res.setHeader('Content-Type', 'application/json');
        if (req.url === '/api/studio-bridge/exchange/')
          res.end(
            JSON.stringify({
              issuer: 'pixelcore',
              subject: 'fixture-owner',
              business: { id: 'fixture-business', name: 'Platform business' },
              user: {
                displayName: 'Platform Owner',
                email: 'owner@example.test',
                settingsUrl: 'http://localhost:3001/settings',
              },
              grant: 'fixture-server-only-restricted-grant',
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
            }),
          );
        else if (value.operation === 'revoke') {
          revoked = true;
          res.end(JSON.stringify({ revoked: true }));
        } else
          res.end(
            JSON.stringify({
              workspace: { id: 'fixture-business', name: 'Platform business', source: 'pixelcore' },
              sites: [],
              sources: [],
              capabilities: { editWebsite: true, manageComponents: false },
            }),
          );
      } catch {
        res.statusCode = 500;
        res.end('{}');
      }
    });
    await new Promise((resolve) => platformServer.listen(hostPort, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => platformServer.close(resolve)));
    let output = '';
    const child = spawn(process.execPath, ['scripts/dev.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        WEBSITE_BUILDER_API_PORT: String(apiPort),
        WEBSITE_BUILDER_COMPONENT_PORT: String(componentPort),
        WEBSITE_BUILDER_DATA_DIR: dataDir,
        STUDIO_PIXELCORE_API_ORIGIN: `http://127.0.0.1:${hostPort}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (b) => (output += b));
    child.stderr.on('data', (b) => (output += b));
    t.after(async () => {
      child.kill('SIGTERM');
      await Promise.race([new Promise((r) => child.once('exit', r)), delay(2500)]);
      await rm(dataDir, { recursive: true, force: true });
    });
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(`${base}/api/website-builder/csrf/`);
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(100);
    }
    assert.ok(ready, output);
    const cookies = new Map();
    const request = async (path, method = 'GET', body) => {
      const response = await fetch(base + path, {
        method,
        headers: {
          Origin: `http://localhost:${port}`,
          Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
          'X-CSRFToken': cookies.get('studio_csrftoken') || '',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      for (const cookie of response.headers.getSetCookie()) {
        const [key, ...value] = cookie.split(';')[0].split('=');
        cookies.set(key, value.join('='));
      }
      const json = await response.json();
      assert.equal(response.status, 200, JSON.stringify(json));
      return { json, response };
    };
    const home = await fetch(base);
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /type="importmap"/);
    assert.match(html, /<title>Pixelcore Studio<\/title>/);
    const iconPath = html.match(/rel="icon"[^>]*href="([^"]+)"/)[1];
    const brandIcon = await fetch(base + iconPath);
    assert.equal(brandIcon.status, 200);
    assert.equal(brandIcon.headers.get('content-type'), 'image/webp');
    assert.deepEqual(
      Buffer.from(await brandIcon.arrayBuffer()),
      await readFile('packages/editor/src/assets/pixelcore-studio-icon.webp'),
    );
    const loadingCss = await fetch(base + '/studio/web/states.css');
    assert.equal(loadingCss.status, 200);
    assert.match(loadingCss.headers.get('content-type'), /text\/css/);
    assert.match(await loadingCss.text(), /prefers-reduced-motion/);
    const placeholder = await fetch(base + '/studio/web/assets/state-placeholder.svg');
    assert.equal(placeholder.status, 200);
    assert.equal(placeholder.headers.get('content-type'), 'image/svg+xml');
    assert.match(await placeholder.text(), /<svg/);
    const missingStudio = await fetch(base + '/studio/missing-website');
    assert.equal(missingStudio.status, 404);
    assert.match(missingStudio.headers.get('content-type'), /text\/html/);
    assert.match(await missingStudio.text(), /studio\/web\/app.js/);
    const denied = await fetch(`${base}/.data/secret.key`);
    assert.equal(denied.status, 404);
    const lab = await fetch(`${base}/studio/components`);
    assert.equal(lab.status, 200);
    assert.match(await lab.text(), /Pixelcore Studio/);
    assert.equal((await fetch(`${base}/studio/server/component_lab/views.py`)).status, 404);
    assert.equal(
      (await fetch(`http://127.0.0.1:${componentPort}/api/studio/components/`)).status,
      404,
    );
    await request('/api/studio/session/');
    await request('/api/studio/session/', 'POST', {
      enroll: true,
      username: 'isolated-studio-owner',
      password: 'studio-isolated-http-test-password',
    });
    const cookie = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const starter = await fetch(`${base}/api/studio/starter/`, { headers: { Cookie: cookie() } });
    assert.equal(starter.status, 200);
    const form = new FormData();
    form.append(
      'file',
      new Blob([await starter.arrayBuffer()], { type: 'application/zip' }),
      'orbit.zip',
    );
    const imported = await fetch(`${base}/api/studio/components/`, {
      method: 'POST',
      body: form,
      headers: {
        Origin: `http://localhost:${port}`,
        Cookie: cookie(),
        'X-CSRFToken': cookies.get('studio_csrftoken'),
      },
    });
    assert.equal(imported.status, 201, await imported.clone().text());
    const component = (await imported.json()).component;
    const preview = await fetch(component.entryUrl);
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get('content-security-policy'), /sandbox allow-scripts;/);
    assert.ok(!preview.headers.get('content-security-policy').includes('allow-same-origin'));
    assert.match(await preview.text(), /component:init/);
    const beforeApproval = await request('/api/studio/catalog/');
    assert.equal(beforeApproval.json.components.length, 0);
    await request(`/api/studio/components/${component.id}/approve/`, 'POST', {
      version: 1,
      expectedApproved: null,
    });
    const catalog = await request('/api/studio/catalog/');
    assert.equal(catalog.json.components[0].id, component.id);
    await request('/api/website-builder/csrf/');
    const setup = await request('/api/demo/bootstrap/', 'POST', { document: createDocument() });
    const site = setup.json;
    const section = site.document.children[0];
    const saved = await request(`/api/website-builder/sites/${site.id}/sections/`, 'POST', {
      name: 'Reusable intro',
      node: section,
    });
    assert.equal(saved.json.sections[0].name, 'Reusable intro');
    const library = await request(`/api/website-builder/sites/${site.id}/sections/`);
    assert.equal(library.json.sections[0].node.id, section.id);
    const template = await request(`/api/website-builder/sites/${site.id}/templates/`, 'POST', {
      name: 'Reusable page',
      description: 'Saved from the HTTP editor',
      document: site.document,
    });
    assert.equal(template.json.template.name, 'Reusable page');
    const templates = await request(`/api/website-builder/sites/${site.id}/templates/`);
    assert.equal(templates.json.templates[0].id, template.json.template.id);
    assert.deepEqual(templates.json.templates[0].document.children, site.document.children);
    await request(`/api/website-builder/sites/${site.id}/publish/`, 'POST', {
      expectedVersion: site.version,
    });
    const published = await request(`/api/demo/published/${site.id}/`);
    assert.equal(published.json.document.title, 'Untitled website');
    const review = await request(`/api/website-builder/sites/${site.id}/reviews/`, 'POST', {
      expectedVersion: site.version,
    });
    const token = new URL(review.json.url).hash.slice(1);
    const opened = await request('/api/website-builder/reviews/exchange/', 'POST', { token });
    const share = opened.json;
    const posted = await request(`/api/website-builder/reviews/${share.id}/comments/`, 'POST', {
      name: 'Reviewer',
      body: 'A useful review',
      anchor: { nodeId: site.document.children[0].id, x: 0.25, y: 0.5, viewport: 1100 },
    });
    assert.equal(posted.json.threads[0].comments[0].body, 'A useful review');
    assert.equal(opened.response.headers.get('cache-control'), 'no-store, private');
    await request('/api/studio/session/', 'DELETE');
    const signedOut = await request('/api/studio/session/');
    assert.equal(signedOut.json.silentConnectAllowed, false);
    const pending = await request('/api/studio/connect/begin/', 'POST', {
      platformId: 'pixelcore',
    });
    const connected = await request('/api/studio/connect/complete/', 'POST', {
      platformId: 'pixelcore',
      state: pending.json.state,
      code: 'fixture-one-use-code',
    });
    assert.equal(connected.json.user.displayName, 'Platform Owner');
    assert.equal(connected.json.capabilities.manageComponents, false);
    assert.ok(!JSON.stringify(connected.json).includes('fixture-server-only-restricted-grant'));
    const workspace = await request('/api/studio/workspace/');
    assert.equal(workspace.json.workspace.name, 'Platform business');
    assert.equal(
      (await fetch(base + '/api/demo/bootstrap/', { headers: { Cookie: cookie() } })).status,
      403,
    );
    await request('/api/studio/session/', 'DELETE');
    assert.equal(revoked, true);
  },
);
