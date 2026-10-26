import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import axe from 'axe-core';
import { mountStudio, safeReturn } from '../studio/web/studio.js';
import { avatarNode } from '../studio/web/shell.js';
import { mountSettings } from '../studio/web/settings.js';
import { mountAnalytics } from '../studio/web/analytics.js';
const fixture = () => ({
  authenticated: true,
  username: 'owner',
  user: {
    id: '1',
    username: 'owner',
    displayName: 'Studio Owner',
    email: 'owner@example.test',
    avatarUrl: '',
    source: 'studio',
  },
  platforms: [],
  capabilities: { editWebsite: true, manageComponents: true },
});
const workspace = () => ({
  workspace: { id: 'local-demo', name: 'Example workspace', source: 'studio', sample: true },
  sites: [
    {
      id: 'site-1',
      title: 'Example store',
      updatedAt: '2026-10-24T10:00:00Z',
      version: 3,
      published: true,
      pageCount: 1,
    },
  ],
  sources: [],
});
const dom = (t, path = '/studio') => {
  const w = new Window({
    url: 'http://localhost:4173' + path,
    settings: {
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
      disableIframePageLoading: true,
    },
  });
  const host = w.document.createElement('div');
  w.document.body.append(host);
  t.after(() => w.happyDOM.abort());
  return { w, host };
};
const findButton = (root, label) =>
  [...root.querySelectorAll('button')].find(
    (b) => b.textContent === label || b.getAttribute('aria-label') === label,
  );
const tick = () => new Promise((r) => setImmediate(r));
test('dashboard restores shared identity and exposes real workspace actions without fake traffic', async (t) => {
  const { w, host } = dom(t);
  const calls = [];
  const app = mountStudio(host, {
    fetcher: async (path) => {
      calls.push(path);
      return { ok: true, json: async () => (path.endsWith('session/') ? fixture() : workspace()) };
    },
  });
  await app.ready;
  assert.match(host.shadowRoot.textContent, /Example store/);
  assert.match(host.shadowRoot.textContent, /Studio Owner/);
  assert.equal(
    host.shadowRoot.querySelector('[aria-current="page"]').getAttribute('href'),
    '/studio',
  );
  assert.equal(
    host.shadowRoot.querySelector('a[href="/studio/builder?site=site-1"]').textContent,
    'Edit website',
  );
  assert.equal(calls.length, 2);
  assert.ok(!host.shadowRoot.textContent.includes('34,820'));
  const theme = findButton(host.shadowRoot, 'Switch to dark mode');
  theme.click();
  assert.equal(host.dataset.editorAppearance, 'dark');
  const avatar = avatarNode(w.document, {
    displayName: 'Studio Owner',
    avatarUrl: '/missing.webp',
  });
  avatar.querySelector('img').dispatchEvent(new w.Event('error'));
  assert.equal(avatar.textContent, 'SO');
  app.destroy();
  assert.equal(host.shadowRoot.children.length, 0);
});
test('anonymous entry uses a real login form and safe internal return path', async (t) => {
  const { host } = dom(t, '/studio/builder');
  let count = 0;
  const app = mountStudio(host, {
    fetcher: async () => {
      count++;
      return {
        ok: true,
        json: async () => ({ authenticated: false, canEnroll: false, platforms: [] }),
      };
    },
  });
  await app.ready;
  assert.ok(host.shadowRoot.querySelector('form[novalidate]'));
  assert.ok(host.shadowRoot.querySelector('input[autocomplete="current-password"]'));
  assert.equal(count, 1);
  assert.equal(safeReturn('https://evil.example'), '/studio');
  assert.equal(safeReturn('//evil.example'), '/studio');
  assert.equal(safeReturn('/studio/builder?site=a'), '/studio/builder?site=a');
  app.destroy();
});
test('settings retains failed profile input, prevents duplicates and saves shared identity', async (t) => {
  const { host } = dom(t, '/studio/settings');
  let reject = true,
    calls = 0,
    updated;
  const view = mountSettings(host, {
    session: fixture(),
    appearance: { value: 'light', set() {} },
    onSession: (v) => (updated = v),
    client: {
      send: async () => {
        calls++;
        await tick();
        if (reject) throw new Error('Offline. Try again.');
        return fixture();
      },
    },
  });
  const name = host.querySelector('input[autocomplete="name"]');
  name.value = 'Updated';
  name.dispatchEvent(new host.ownerDocument.defaultView.Event('input', { bubbles: true }));
  findButton(host, 'Save profile').click();
  findButton(host, 'Save profile').click();
  await tick();
  await tick();
  assert.equal(calls, 1);
  assert.equal(name.value, 'Updated');
  assert.match(host.textContent, /Offline/);
  assert.equal(view.hasUnsavedChanges, true);
  reject = false;
  findButton(host, 'Save profile').click();
  await tick();
  await tick();
  assert.ok(updated);
  assert.equal(view.hasUnsavedChanges, false);
  view.destroy();
});
test('analytics guide distinguishes draft save, publication and explicit user confirmation', async (t) => {
  const { host } = dom(t, '/studio/analytics');
  const config = { provider: 'google', domain: 'example.com', measurementId: 'G-ABCDEFG123' };
  let writes = 0;
  const view = await mountAnalytics(host, {
    workspace: workspace(),
    client: {
      send: async (path, options) => {
        if (options) writes++;
        return {
          draft: config,
          published: { provider: 'none', domain: '' },
          status: 'Draft configuration',
          version: 4,
          consentAvailable: false,
        };
      },
    },
  });
  assert.match(host.textContent, /Draft configuration/);
  assert.match(host.textContent, /tracking disabled/);
  assert.equal(findButton(host, 'I verified visits in my provider').disabled, true);
  assert.equal(writes, 0);
  findButton(host, 'Publish configuration').click();
  assert.ok(host.querySelector('dialog'));
  assert.equal(writes, 0);
  findButton(host, 'Cancel').click();
  assert.equal(host.querySelector('dialog'), null);
  view.destroy();
});
test('shared Studio dashboard has named controls and valid ARIA in both appearances', async (t) => {
  const { w, host } = dom(t);
  const app = mountStudio(host, {
    fetcher: async (path) => ({
      ok: true,
      json: async () => (path.endsWith('session/') ? fixture() : workspace()),
    }),
  });
  await app.ready;
  w.eval(axe.source);
  for (const mode of ['light', 'dark']) {
    if (mode === 'dark') findButton(host.shadowRoot, 'Switch to dark mode').click();
    const result = await w.axe.run(w.document, {
      runOnly: {
        type: 'rule',
        values: [
          'button-name',
          'link-name',
          'label',
          'aria-valid-attr',
          'aria-valid-attr-value',
          'aria-allowed-attr',
        ],
      },
    });
    assert.equal(
      result.violations.length,
      0,
      JSON.stringify(
        result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html) })),
      ),
    );
  }
  app.destroy();
});
