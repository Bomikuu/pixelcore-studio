import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import axe from 'axe-core';
import { loadingState, errorState, errorKind } from '../studio/web/states.js';
import { mountStudio } from '../studio/web/studio.js';
const tick = () => new Promise((resolve) => setImmediate(resolve));
const session = {
  authenticated: true,
  user: { displayName: 'Studio Owner', source: 'studio' },
  capabilities: { editWebsite: true, manageComponents: false },
  platforms: [],
};
const workspace = { workspace: { name: 'Examples', sample: true }, sites: [], sources: [] };
const response = (value, status = 200) => ({ ok: status < 400, status, json: async () => value });
function dom(t, path = '/studio') {
  const w = new Window({
      url: 'http://localhost:4173' + path,
      settings: {
        disableCSSFileLoading: true,
        disableIframePageLoading: true,
        enableJavaScriptEvaluation: true,
        suppressInsecureJavaScriptEnvironmentWarning: true,
      },
    }),
    host = w.document.createElement('div');
  w.document.body.append(host);
  t.after(() => w.happyDOM.abort());
  return { w, host };
}
const retry = (root) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent === 'Try again');

test('centered spinner loading announces real stages, respects saved appearance and supports reduced motion', async (t) => {
  const { w, host } = dom(t);
  w.localStorage.setItem('sitebuilder:appearance:v1', 'dark');
  const loading = loadingState(w.document, { fullscreen: true });
  host.append(loading.element);
  assert.equal(loading.element.getAttribute('role'), 'status');
  assert.equal(loading.element.getAttribute('aria-busy'), 'true');
  assert.ok(host.querySelector('.state-spinner'));
  assert.equal(host.querySelector('.state-spinner').getAttribute('aria-hidden'), 'true');
  assert.equal(loading.element.style.getPropertyValue('--editor-background'), '#101112');
  loading.update('Connecting your workspace…', 'Checking your account.');
  assert.equal(host.querySelector('.state-title').textContent, 'Connecting your workspace…');
  assert.equal(host.querySelector('[role=progressbar]'), null);
  const css = await readFile(new URL('../studio/web/states.css', import.meta.url), 'utf8');
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /animation:\s*none/);
  assert.match(css, /justify-content:\s*center/);
});
test('error classification distinguishes missing, forbidden, expired and connection failures from code errors', () => {
  assert.equal(errorKind({ status: 404 }), 'missing');
  assert.equal(errorKind({ status: 403 }), 'access');
  assert.equal(errorKind({ status: 401 }), 'session');
  assert.equal(errorKind(new TypeError('Failed to fetch')), 'offline');
  assert.equal(errorKind(new TypeError('Undefined property')), 'unavailable');
  assert.equal(errorKind(new Error('Unavailable'), { online: false }), 'offline');
});
test('illustrated errors expose meaningful recovery and safely render error detail text', (t) => {
  const { w, host } = dom(t);
  const state = errorState(w.document, {
    error: Object.assign(new Error('<script>unsafe()</script>'), { status: 404 }),
    onRetry: () => {
      throw Error('Should not retry missing page');
    },
  });
  host.append(state.element);
  state.focus();
  assert.match(host.querySelector('h1').textContent, /isn’t here/);
  assert.equal(host.querySelector('img').getAttribute('alt'), '');
  assert.equal(host.querySelector('img').getAttribute('width'), '256');
  assert.equal(retry(host), undefined);
  assert.equal(host.querySelector('a').getAttribute('href'), '/studio');
  assert.equal(host.querySelector('script'), null);
  assert.match(host.querySelector('details').textContent, /<script>/);
  assert.equal(w.document.activeElement, host.querySelector('h1'));
});
test('failed placeholder imagery falls back to a static spinner without losing recovery actions', (t) => {
  const { w, host } = dom(t);
  const state = errorState(w.document, {
    error: new Error('Temporary failure'),
    onRetry: async () => {},
  });
  host.append(state.element);
  host.querySelector('img').dispatchEvent(new w.Event('error'));
  assert.equal(host.querySelector('img').hidden, true);
  assert.equal(host.querySelector('.state-spinner').hidden, false);
  assert.ok(host.querySelector('.state-spinner.is-static'));
  assert.ok(retry(host));
});
test('error retry guards duplicates and retains a recoverable error when retry rejects', async (t) => {
  const { w, host } = dom(t);
  let fail,
    calls = 0;
  const state = errorState(w.document, {
    error: new Error('Unavailable'),
    onRetry: () => {
      calls++;
      return new Promise((_, reject) => (fail = reject));
    },
  });
  host.append(state.element);
  const control = retry(host);
  control.click();
  control.click();
  assert.equal(calls, 1);
  assert.equal(control.disabled, true);
  fail(new Error('Still offline'));
  await tick();
  assert.equal(control.disabled, false);
  assert.match(host.querySelector('.state-action-error').textContent, /Still offline/);
  assert.equal(state.element.isConnected, true);
});
test('Studio changes its centered loading message only as actual requests advance', async (t) => {
  const { host } = dom(t);
  let resolveSession, resolveWorkspace;
  const app = mountStudio(host, {
    fetcher: (path) =>
      path.endsWith('session/')
        ? new Promise((resolve) => (resolveSession = resolve))
        : new Promise((resolve) => (resolveWorkspace = resolve)),
  });
  assert.match(host.textContent, /Opening Pixelcore Studio/);
  assert.ok(host.querySelector('.state-spinner'));
  resolveSession(response(session));
  await tick();
  assert.match(host.textContent, /Connecting your workspace/);
  resolveWorkspace(response(workspace));
  await app.ready;
  assert.match(host.shadowRoot.textContent, /Overview/);
  assert.equal(host.shadowRoot.querySelector('.studio-state[aria-busy=true]'), null);
  app.destroy();
});
test('retry after an initial failure renders loading inside the existing shadow root and opens the workspace', async (t) => {
  const { host } = dom(t);
  let calls = 0,
    finish;
  const app = mountStudio(host, {
    fetcher: async (path) => {
      if (path.endsWith('session/')) {
        if (++calls === 1) return response({ error: { message: 'API unavailable' } }, 503);
        return new Promise((resolve) => (finish = resolve));
      }
      return response(workspace);
    },
  });
  await app.ready;
  let root = host.shadowRoot;
  assert.ok(root.querySelector('.state-illustration'));
  retry(root).click();
  assert.ok(root.querySelector('.state-spinner'));
  assert.equal(retry(root), undefined);
  finish(response(session));
  for (let i = 0; i < 5; i++) await tick();
  assert.match(root.textContent, /Overview/);
  assert.equal(root.querySelectorAll('nav').length, 1);
  app.destroy();
});
test('an expired workspace session offers sign-in with a safe builder return destination', async (t) => {
  const { host } = dom(t, '/studio/builder?site=sample');
  const app = mountStudio(host, {
    fetcher: async (path) =>
      path.endsWith('session/')
        ? response(session)
        : response({ error: { message: 'Sign in again' } }, 401),
  });
  await app.ready;
  const link = host.shadowRoot.querySelector('.state-link.primary');
  assert.equal(link.textContent, 'Sign in');
  assert.equal(new URL(link.href).searchParams.get('next'), '/studio/builder?site=sample');
  assert.equal(retry(host.shadowRoot), undefined);
  app.destroy();
});
test('unknown Studio routes show a real missing-page state without requesting workspace data', async (t) => {
  const { host } = dom(t, '/studio/does-not-exist');
  const calls = [];
  const app = mountStudio(host, {
    fetcher: async (path) => {
      calls.push(path);
      return response(session);
    },
  });
  await app.ready;
  assert.match(host.shadowRoot.querySelector('h1').textContent, /isn’t here/);
  assert.equal(calls.length, 1);
  assert.equal(host.shadowRoot.querySelector('.studio-summary'), null);
  app.destroy();
});
test('Component Lab permission errors use the illustrated access screen', async (t) => {
  const { host } = dom(t, '/studio/components');
  const app = mountStudio(host, {
    fetcher: async (path) => response(path.endsWith('session/') ? session : workspace),
  });
  await app.ready;
  assert.match(host.shadowRoot.querySelector('h1').textContent, /needs permission/);
  assert.ok(host.shadowRoot.querySelector('img.state-illustration'));
  assert.equal(retry(host.shadowRoot), undefined);
  app.destroy();
});
test('state controls have accessible names and valid ARIA without interactive decorative art', async (t) => {
  const { w, host } = dom(t);
  host.append(
    errorState(w.document, { error: new Error('Service unavailable'), onRetry: async () => {} })
      .element,
  );
  w.eval(axe.source);
  const result = await w.axe.run(host, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations.map((v) => v.id)));
  assert.equal(host.querySelectorAll('.state-spinner button').length, 0);
});
