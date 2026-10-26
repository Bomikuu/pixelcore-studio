import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import axe from 'axe-core';
import { mountLab } from '../studio/web/lab.js';
import {
  mountComponent,
  componentSettings,
  publicComponentData,
  createCatalogClient,
  enhanceComponents,
} from '../packages/components/src/index.js';
import { createDocument, node, validateDocument } from '../packages/core/src/index.js';
import { mountEditor } from '../packages/editor/src/index.js';
import { renderPage } from '../packages/renderer/src/index.js';
const tick = () => new Promise((r) => setImmediate(r));
const button = (root, label) =>
  [...root.querySelectorAll('button')].find(
    (n) => n.textContent === label || n.getAttribute('aria-label') === label,
  );
const control = (root, label) => {
  const l = [...root.querySelectorAll('label')].find((n) => n.textContent === label);
  assert.ok(l, `Missing ${label}`);
  return root.querySelector(`[id="${l.htmlFor}"]`);
};
const fixture = () => ({
  id: 'aafe5b92-d885-4e52-a82d-2cf2f1aa30fd',
  version: 1,
  name: 'Orbit banner',
  entryUrl:
    'http://localhost:4175/components/public/aafe5b92-d885-4e52-a82d-2cf2f1aa30fd/1/index.html',
  posterUrl: '',
  approved: false,
  currentApproved: null,
  native: null,
  byteSize: 4096,
  fileCount: 3,
  files: ['component.json', 'index.html', 'scene.js'],
  manifest: {
    schemaVersion: 1,
    name: 'Orbit banner',
    description: 'An interactive background.',
    kind: 'background',
    usage: 'landing',
    entry: 'index.html',
    poster: '',
    sourceUrl: '',
    author: '',
    license: '',
    tags: ['threejs'],
    height: 420,
    networkOrigins: [],
    imports: {},
    fallbackText: 'Orbit background',
    fields: [
      { key: 'color', label: 'Orbit color', type: 'color', default: '#3d5afe' },
      { key: 'speed', label: 'Speed', type: 'number', min: 0, max: 3, default: 1 },
    ],
    dataKeys: ['title'],
  },
});
function dom(t) {
  const w = new Window({
    url: 'http://localhost:4173/studio/components',
    settings: {
      disableIframePageLoading: true,
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
  });
  const host = w.document.createElement('div');
  w.document.body.append(host);
  t.after(() => w.happyDOM.abort());
  return { w, host };
}
const json = (value, ok = true) => ({ ok, json: async () => structuredClone(value) });

test('optional catalog reads omit credentials and resolve pinned approved versions', async () => {
  const calls = [],
    item = fixture();
  const client = createCatalogClient(
    'http://localhost:4173/api/studio/catalog/',
    async (url, options) => {
      calls.push({ url, options });
      return json({ schemaVersion: 1, components: [item], component: item });
    },
  );
  assert.equal((await client.list()).length, 1);
  assert.equal((await client.get(item.id, 1)).version, 1);
  assert.ok(calls[1].url.endsWith(`${item.id}/1/`));
  assert.equal(calls[0].options.credentials, 'omit');
  assert.throws(() => createCatalogClient('javascript:alert(1)'));
  await assert.rejects(client.get('../bad', 1));
});
test('settings and public-data bridge reject unknown controls and drop undeclared/private records', () => {
  const item = fixture();
  assert.deepEqual(componentSettings(item.manifest.fields, { speed: 2 }), {
    color: '#3d5afe',
    speed: 2,
  });
  assert.throws(() => componentSettings(item.manifest.fields, { speed: 4 }));
  assert.throws(() => componentSettings(item.manifest.fields, { secret: 'x' }));
  assert.throws(() => componentSettings(item.manifest.fields, { color: 'red;display:none' }));
  assert.deepEqual(
    publicComponentData(['title', 'patients', 'details', 'amount'], {
      title: 'Launch',
      patients: 'private',
      details: { secret: 'x' },
      amount: 12,
    }),
    { title: 'Launch', amount: 12 },
  );
});
test('interactive runtime isolates scripts, validates source/channel, sends public inputs and cleans up fallback on error', async (t) => {
  const { w, host } = dom(t),
    item = fixture();
  host.textContent = 'Poster fallback';
  const statuses = [];
  const runtime = mountComponent(host, item, {
    settings: { speed: 2 },
    publicData: { title: 'Launch', patients: 'private' },
    onStatus: (state, message) => statuses.push([state, message]),
  });
  assert.equal(runtime.frame.getAttribute('sandbox'), 'allow-scripts');
  assert.equal(runtime.frame.referrerPolicy, 'no-referrer');
  let sent;
  Object.defineProperty(runtime.frame, 'contentWindow', {
    value: {
      postMessage: (data) => {
        sent = data;
      },
    },
  });
  runtime.frame.dispatchEvent(new w.Event('load'));
  assert.deepEqual(sent.data, { title: 'Launch' });
  assert.equal(sent.settings.speed, 2);
  const channel = sent.channel;
  w.dispatchEvent(
    new w.MessageEvent('message', { source: w, origin: 'null', data: { channel, type: 'ready' } }),
  );
  assert.equal(statuses.at(-1)[0], 'loading');
  w.dispatchEvent(
    new w.MessageEvent('message', {
      source: runtime.frame.contentWindow,
      origin: 'https://example.com',
      data: { channel, type: 'ready' },
    }),
  );
  assert.equal(statuses.at(-1)[0], 'loading');
  w.dispatchEvent(
    new w.MessageEvent('message', {
      source: runtime.frame.contentWindow,
      origin: 'null',
      data: { channel, type: 'ready' },
    }),
  );
  assert.equal(statuses.at(-1)[0], 'ready');
  runtime.pause();
  assert.equal(sent.motion, false);
  w.dispatchEvent(
    new w.MessageEvent('message', {
      source: runtime.frame.contentWindow,
      origin: 'null',
      data: { channel, type: 'error', message: 'Missing texture' },
    }),
  );
  assert.equal(statuses.at(-1)[1], 'Missing texture');
  assert.equal(host.textContent, 'Poster fallback');
  assert.equal(host.querySelector('iframe'), null);
  runtime.destroy();
});
test('ordinary public pages require no catalog call and component refs render safe native fallbacks', async (t) => {
  const { host } = dom(t);
  host.innerHTML = '<p>Normal website</p>';
  const stop = await enhanceComponents(host, {});
  stop();
  const doc = createDocument(),
    item = fixture(),
    ref = node('component', {
      componentId: item.id,
      componentVersion: 1,
      componentSettings: JSON.stringify({ color: '#3d5afe' }),
      fallbackText: '<script>unsafe</script>',
      name: 'Orbit',
    });
  doc.children.push(ref);
  validateDocument(doc);
  const html = renderPage(doc).html;
  assert.match(html, /data-component-version="1"/);
  assert.ok(html.includes('&lt;script&gt;unsafe'));
  assert.ok(!html.includes('<iframe') && !html.includes('scene.js'));
  ref.props.componentSettings = '{"__proto__":"bad"}';
  assert.throws(() => validateDocument(doc));
});
test('standalone enrollment uses canonical named fields, guarded sign-in and branded navigation', async (t) => {
  const { w, host } = dom(t);
  let authenticated = false;
  const calls = [];
  const app = mountLab(host, {
    fetcher: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('session/')) {
        if (options.method === 'POST') authenticated = true;
        return json({
          authenticated,
          canEnroll: !authenticated,
          username: authenticated ? 'owner' : '',
        });
      }
      return json({ components: [] });
    },
  });
  t.after(() => app.destroy());
  await tick();
  assert.match(app.root.textContent, /Make this Studio yours/);
  assert.equal(app.root.querySelector('.lab-wordmark-name').textContent, 'Pixelcore');
  control(app.root, 'Account name').value = 'owner';
  control(app.root, 'Password').value = 'long-enough-test-password';
  button(app.root, 'Create Studio account').click();
  await tick();
  await tick();
  assert.match(app.root.textContent, /Bring something great/);
  const login = calls.find((c) => c.options.method === 'POST');
  assert.equal(JSON.parse(login.options.body).enroll, true);
  assert.equal(app.root.querySelector('input[type=password]'), null);
  button(app.root, 'Switch to dark mode').click();
  assert.equal(host.dataset.editorAppearance, 'dark');
  assert.equal(
    app.root.querySelector('a[href="/"]').getAttribute('aria-label'),
    'Pixelcore Studio website builder',
  );
});
test('upload errors retain chosen file and context; successful retry opens responsive preview and editable defaults', async (t) => {
  const { w, host } = dom(t);
  let fail = true;
  const item = fixture(),
    calls = [];
  const app = mountLab(host, {
    fetcher: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('session/'))
        return json({ authenticated: true, username: 'owner', canEnroll: false });
      if (url.endsWith(`components/${item.id}/`)) return json({ versions: [item] });
      if (url.endsWith('components/') && options.method === 'POST')
        return fail
          ? json({ error: { message: 'Missing image file' } }, false)
          : json({ component: item });
      return json({ components: [] });
    },
  });
  t.after(() => app.destroy());
  await tick();
  await tick();
  button(app.root, 'Import component').click();
  const file = new w.File(['fake zip'], 'orbit.zip', { type: 'application/zip' });
  const input = app.root.querySelector('input[type=file]');
  Object.defineProperty(input, 'files', { value: [file] });
  input.dispatchEvent(new w.Event('change'));
  const name = control(app.root, 'Name (optional)');
  name.value = 'Imported orbit';
  name.dispatchEvent(new w.Event('change'));
  button(app.root, 'Upload and preview').click();
  await tick();
  assert.match(app.root.querySelector('[role=alert]').textContent, /Missing image/);
  assert.equal(app.state.file.name, 'orbit.zip');
  assert.equal(name.value, 'Imported orbit');
  assert.equal(button(app.root, 'Upload and preview').disabled, false);
  fail = false;
  button(app.root, 'Upload and preview').click();
  await tick();
  await tick();
  assert.match(app.root.textContent, /Make it yours/);
  assert.equal(
    app.root.querySelector('.lab-preview-target iframe').getAttribute('sandbox'),
    'allow-scripts',
  );
  button(app.root, 'Phone').click();
  assert.equal(app.root.querySelector('.lab-preview-target').style.width, '390px');
  const speed = control(app.root, 'Speed');
  speed.value = '2';
  speed.dispatchEvent(new w.Event('change'));
  assert.equal(app.state.values.speed, 2);
  assert.equal(app.state.dirty, true);
  button(app.root, 'Back to library').click();
  assert.ok(app.root.querySelector('.lab-discard'));
  button(app.root, 'Keep editing').click();
  assert.equal(control(app.root, 'Speed').value, '2');
});
test('saving defaults creates a version before approval; export/history and sample inputs remain usable', async (t) => {
  const { w, host } = dom(t);
  let item = fixture(),
    versions = [item];
  const calls = [];
  w.history.replaceState({}, '', '/studio/components?component=' + item.id);
  const app = mountLab(host, {
    fetcher: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('session/')) return json({ authenticated: true, username: 'owner' });
      if (url.endsWith('approve/')) {
        item = { ...item, currentApproved: item.version, approved: true };
        versions[0] = item;
        return json({ component: item });
      }
      if (url.endsWith(`components/${item.id}/`)) {
        if (options.method === 'PUT') {
          const value = JSON.parse(options.body);
          item = { ...item, version: 2, manifest: value.manifest };
          versions = [item, ...versions];
          return json({ component: item });
        }
        return json({ versions });
      }
      return json({ components: [item] });
    },
  });
  t.after(() => app.destroy());
  await tick();
  await tick();
  const color = control(app.root, 'Orbit color');
  color.value = '#ff0000';
  color.dispatchEvent(new w.Event('change'));
  button(app.root, 'Save defaults').click();
  await tick();
  await tick();
  assert.equal(app.state.selected.version, 2);
  assert.equal(app.state.dirty, false);
  assert.equal(calls.filter((c) => c.url.endsWith('approve/')).length, 0);
  button(app.root, 'Add to catalog').click();
  await tick();
  await tick();
  assert.equal(app.state.selected.currentApproved, 2);
  assert.equal(button(app.root, 'In catalog').disabled, true);
  button(app.root, 'Details').click();
  assert.ok(app.root.querySelector('a[href$="export/2/"]'));
  button(app.root, 'Versions').click();
  assert.ok(button(app.root, 'Version 1 · Draft'));
  button(app.root, 'Version 1 · Draft').click();
  await tick();
  assert.equal(app.state.selected.version, 1);
  assert.equal(button(app.root, 'Save defaults').disabled, true);
});
test('configured editor inserts catalog components once and supports their declared settings; default editor excludes catalog UI', async (t) => {
  const { w, host } = dom(t),
    doc = createDocument(),
    item = fixture();
  let editor = mountEditor(host, { document: doc, adapter: {} });
  assert.equal(host.shadowRoot.querySelector('[data-tool-catalog]'), null);
  editor.destroy();
  const saved = globalThis.fetch;
  globalThis.fetch = async () => json({ schemaVersion: 1, components: [item], component: item });
  t.after(() => {
    globalThis.fetch = saved;
    editor.destroy();
  });
  editor = mountEditor(host, {
    document: doc,
    adapter: {},
    componentCatalog: { url: 'http://localhost:4173/api/studio/catalog/' },
    saveDelay: 60000,
  });
  button(host.shadowRoot, 'Component catalog').click();
  await tick();
  await tick();
  button(host.shadowRoot, 'Add Orbit banner').click();
  await tick();
  const added = editor.getDocument().children.find((c) => c.type === 'component');
  assert.ok(added);
  assert.equal(added.props.componentVersion, 1);
  assert.equal(control(host.shadowRoot, 'Speed').value, '1');
  const speed = control(host.shadowRoot, 'Speed');
  speed.value = '2';
  speed.dispatchEvent(new w.Event('change'));
  assert.equal(
    JSON.parse(editor.getDocument().children.find((c) => c.id === added.id).props.componentSettings)
      .speed,
    2,
  );
  button(host.shadowRoot, 'Component catalog').click();
  assert.ok(host.shadowRoot.querySelector('.component-catalog-dialog'));
});
test('standalone library and workspace expose valid names and ARIA in both appearances', async (t) => {
  const { w, host } = dom(t),
    item = fixture();
  const app = mountLab(host, {
    fetcher: async (url) =>
      url.endsWith('session/')
        ? json({ authenticated: true, username: 'owner' })
        : url.endsWith(`components/${item.id}/`)
          ? json({ versions: [item] })
          : json({ components: [item] }),
  });
  t.after(() => app.destroy());
  await tick();
  await tick();
  w.document.documentElement.lang = 'en';
  w.eval(axe.source);
  for (const mode of ['light', 'dark']) {
    if (host.dataset.editorAppearance !== mode) button(app.root, 'Switch to dark mode').click();
    const results = await w.axe.run(w.document, {
      iframes: false,
      runOnly: {
        type: 'rule',
        values: [
          'button-name',
          'label',
          'aria-allowed-attr',
          'aria-valid-attr-value',
          'select-name',
          'frame-title',
        ],
      },
    });
    assert.equal(results.violations.length, 0, JSON.stringify(results.violations.map((v) => v.id)));
  }
  button(app.root, 'Open Orbit banner').click();
  await tick();
  const result = await w.axe.run(w.document, {
    iframes: false,
    runOnly: {
      type: 'rule',
      values: [
        'button-name',
        'label',
        'aria-allowed-attr',
        'aria-valid-attr-value',
        'select-name',
        'frame-title',
      ],
    },
  });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations.map((v) => v.id)));
});

test('native catalog sections hydrate only on selection and ignore late reads after closing', async (t) => {
  const { host } = dom(t),
    item = fixture(),
    native = createDocument();
  const saved = globalThis.fetch;
  let reads = 0,
    release;
  globalThis.fetch = async (url) => {
    if (url.endsWith(`/${item.id}/1/`)) {
      reads++;
      await new Promise((r) => (release = r));
      return json({ schemaVersion: 1, component: { ...item, native } });
    }
    return json({ schemaVersion: 1, components: [{ ...item, native: true }] });
  };
  const editor = mountEditor(host, {
    document: createDocument(),
    adapter: {},
    componentCatalog: { url: 'http://localhost:4173/api/studio/catalog/' },
    saveDelay: 60000,
  });
  t.after(() => {
    globalThis.fetch = saved;
    editor.destroy();
  });
  button(host.shadowRoot, 'Component catalog').click();
  await tick();
  await tick();
  assert.equal(reads, 0);
  button(host.shadowRoot, 'Add Orbit banner').click();
  await tick();
  assert.equal(reads, 1);
  button(host.shadowRoot, 'Close').click();
  release();
  await tick();
  assert.equal(editor.getDocument().children.length, 2);
  button(host.shadowRoot, 'Component catalog').click();
  await tick();
  button(host.shadowRoot, 'Add Orbit banner').click();
  await tick();
  release();
  await tick();
  assert.equal(editor.getDocument().children.length, 3);
  assert.ok(!editor.getDocument().children.some((n) => n.type === 'component'));
});
test('aborting an optional runtime load prevents late iframe mounting', async (t) => {
  const { host } = dom(t),
    item = fixture();
  host.innerHTML = `<div data-component-id="${item.id}" data-component-version="1"><p>Fallback</p></div>`;
  const saved = globalThis.fetch;
  let resolve;
  globalThis.fetch = () => new Promise((r) => (resolve = r));
  t.after(() => {
    globalThis.fetch = saved;
  });
  const controller = new AbortController();
  const pending = enhanceComponents(host, {
    catalogUrl: 'http://localhost:4173/api/studio/catalog/',
    signal: controller.signal,
  });
  controller.abort();
  resolve(json({ schemaVersion: 1, component: item }));
  const stop = await pending;
  assert.equal(host.querySelector('iframe'), null);
  assert.match(host.textContent, /Fallback/);
  stop();
});

test('React and Vue public adapters opt into the runtime and dispose it without loading normal pages', async (t) => {
  const { w, host } = dom(t),
    item = fixture(),
    doc = createDocument();
  doc.children = [
    node('component', {
      name: item.name,
      componentId: item.id,
      componentVersion: 1,
      componentSettings: '{}',
    }),
  ];
  const names = [
    'window',
    'document',
    'HTMLElement',
    'Element',
    'SVGElement',
    'Node',
    'IS_REACT_ACT_ENVIRONMENT',
  ];
  const previous = names.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  for (const key of names)
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : w[key] || w,
    });
  const saved = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return json({ schemaVersion: 1, component: item });
  };
  t.after(() => {
    globalThis.fetch = saved;
    for (const [k, descriptor] of previous)
      descriptor ? Object.defineProperty(globalThis, k, descriptor) : delete globalThis[k];
  });
  const { createApp, h } = await import('vue'),
    { WebsitePage: VuePage } = await import('../packages/vue/src/index.js');
  let app = createApp({
    render: () =>
      h(VuePage, {
        document: doc,
        componentCatalog: { url: 'http://localhost:4173/api/studio/catalog/' },
        componentData: { title: 'Public' },
      }),
  });
  app.mount(host);
  for (let i = 0; i < 10 && !host.querySelector('iframe'); i++) await tick();
  assert.equal(host.querySelector('iframe')?.getAttribute('sandbox'), 'allow-scripts');
  app.unmount();
  assert.equal(host.querySelector('iframe'), null);
  const { createRoot } = await import('react-dom/client'),
    { createElement, act } = await import('react'),
    { WebsitePage: ReactPage } = await import('../packages/react/src/index.js');
  const reactRoot = createRoot(host);
  await act(async () => {
    reactRoot.render(
      createElement(ReactPage, {
        document: doc,
        componentCatalog: { url: 'http://localhost:4173/api/studio/catalog/' },
        componentData: { title: 'Public' },
      }),
    );
    await tick();
  });
  for (let i = 0; i < 10 && !host.querySelector('iframe'); i++) await tick();
  assert.equal(host.querySelector('iframe')?.getAttribute('sandbox'), 'allow-scripts');
  await act(async () => reactRoot.unmount());
  const before = requests;
  app = createApp({
    render: () =>
      h(VuePage, {
        document: createDocument(),
        componentCatalog: { url: 'http://localhost:4173/api/studio/catalog/' },
      }),
  });
  app.mount(host);
  await tick();
  assert.equal(requests, before);
  app.unmount();
});
