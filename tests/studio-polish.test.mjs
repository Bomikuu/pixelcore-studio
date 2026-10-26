import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { mountStudio } from '../studio/web/studio.js';
import { mountDashboard } from '../studio/web/dashboard.js';
import { passwordField } from '../packages/editor/src/components/ui/index.js';
import { createDocument } from '../packages/core/src/index.js';
const tick = () => new Promise((r) => setImmediate(r));
const findButton = (root, label) =>
  [...root.querySelectorAll('button')].find(
    (b) => b.textContent === label || b.getAttribute('aria-label') === label,
  );
const session = () => ({
  authenticated: true,
  user: {
    displayName: 'Studio Owner',
    username: 'owner',
    source: 'studio',
    email: 'owner@example.test',
  },
  platforms: [],
  capabilities: { editWebsite: true, manageComponents: true },
});
const workspace = () => ({
  workspace: { id: 'local-demo', name: 'Samples', source: 'studio', sample: true },
  sites: [
    {
      id: 'first',
      title: 'Published site',
      published: true,
      unpublishedChanges: false,
      version: 1,
      updatedAt: '2026-10-24T10:00:00Z',
      pageCount: 1,
    },
    {
      id: 'second',
      title: 'Pending site',
      published: true,
      unpublishedChanges: true,
      version: 2,
      updatedAt: '2026-10-25T01:00:00Z',
      pageCount: 1,
    },
    {
      id: 'third',
      title: 'Draft site',
      published: false,
      unpublishedChanges: true,
      version: 1,
      updatedAt: '2026-10-25T01:00:00Z',
      pageCount: 1,
    },
  ],
  sources: [],
});
function dom(t, path = '/studio') {
  const w = new Window({
      url: 'http://localhost:4173' + path,
      settings: { disableIframePageLoading: true },
    }),
    host = w.document.createElement('div');
  w.document.body.append(host);
  t.after(() => w.happyDOM.abort());
  return { w, host };
}
test('dashboard owns one navigation sidebar and its mobile disclosure remains keyboard operable', async (t) => {
  const { w, host } = dom(t);
  const app = mountStudio(host, {
    fetcher: async (url) => ({
      ok: true,
      json: async () => (url.endsWith('session/') ? session() : workspace()),
    }),
  });
  await app.ready;
  const root = host.shadowRoot;
  assert.equal(root.querySelectorAll('header').length, 1);
  assert.equal(root.querySelectorAll('nav').length, 1);
  assert.equal(root.querySelectorAll('.studio-rail').length, 0);
  const toggle = findButton(root, 'Open navigation');
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  toggle.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  app.destroy();
});
test('password visibility is an accessible icon inside the shared Shadcn input group', (t) => {
  const { w, host } = dom(t);
  const password = passwordField(w.document, 'Password', 'current-password');
  host.append(password.field);
  assert.equal(password.input.dataset.slot, 'input');
  assert.ok(password.input.classList.contains('ui-input'));
  assert.equal(password.input.parentElement.dataset.slot, 'input-group');
  assert.equal(password.reveal.parentElement, password.input.parentElement);
  assert.equal(password.reveal.textContent, '');
  assert.ok(password.reveal.querySelector('svg'));
  assert.equal(password.reveal.type, 'button');
  password.input.value = 'a private test password';
  password.input.setSelectionRange(2, 5);
  password.reveal.click();
  assert.equal(password.input.type, 'text');
  assert.equal(password.reveal.getAttribute('aria-label'), 'Hide password');
  assert.equal(password.input.selectionStart, 2);
  assert.equal(password.input.selectionEnd, 5);
  password.reveal.click();
  assert.equal(password.input.type, 'password');
  assert.equal(password.reveal.getAttribute('aria-pressed'), 'false');
  assert.equal(password.input.value, 'a private test password');
});
test('overview summary tiles use actual totals and publication filters include saved updates', (t) => {
  const { host } = dom(t);
  const value = workspace();
  value.summary = { websites: 105, published: 2, drafts: 2, updatedAt: '2026-10-25T01:00:00Z' };
  const app = mountDashboard(host, { workspace: value });
  assert.equal(host.querySelectorAll('.studio-summary-tile').length, 4);
  assert.equal(host.querySelector('.studio-summary-tile dd').textContent, '105');
  findButton(host, 'Published').click();
  assert.equal(host.querySelectorAll('.studio-site-row').length, 2);
  findButton(host, 'Unpublished').click();
  assert.equal(host.querySelectorAll('.studio-site-row').length, 2);
  assert.match(host.querySelector('.studio-site-list').textContent, /Pending site/);
  assert.match(host.querySelector('.studio-site-list').textContent, /Draft site/);
  findButton(host, 'All').click();
  assert.equal(host.querySelectorAll('.studio-site-row').length, 3);
  app.destroy();
});
test('the loaded builder renders one editor header and one tool rail without a nested Studio shell', async (t) => {
  const { w, host } = dom(t, '/studio/builder');
  const document = createDocument();
  document.context = { version: 1, purpose: 'landing', sourceId: 'sample', setupComplete: 1 };
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ components: [] }),
  }));
  const setup = {
    id: 'site',
    document,
    version: 1,
    data: {},
    capabilities: { workspace: { version: 1, sourceName: 'Sample website' }, features: [] },
  };
  const app = mountStudio(host, {
    fetcher: async (url) => ({
      ok: true,
      json: async () =>
        url.endsWith('session/') ? session() : url.endsWith('workspace/') ? workspace() : setup,
    }),
  });
  await app.ready;
  await tick();
  const root = host.shadowRoot,
    editor = root.querySelector('.studio-editor-host').shadowRoot;
  assert.equal(root.querySelectorAll('header').length, 0);
  assert.equal(root.querySelectorAll('nav').length, 0);
  assert.equal(editor.querySelectorAll('header').length, 1);
  assert.equal(editor.querySelectorAll('nav.toolrail').length, 1);
  assert.ok(editor.querySelector('[aria-label="Account menu"]'));
  assert.ok(findButton(editor, 'Back to dashboard'));
  const names = [...editor.querySelectorAll('.toolbar .button-label')].map((n) => n.textContent);
  assert.ok(names.includes('Save draft'));
  assert.ok(names.includes('Publish'));
  app.destroy();
  assert.equal(host.shadowRoot.children.length, 0);
});
