import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import {
  createDocument,
  node,
  validateDocument,
  applyOperation,
  effectiveStyle,
  styleOrigin,
  contrastFindings,
  checkContrast,
  clearRecoveryCopies,
} from '../packages/core/src/index.js';
import { renderPage } from '../packages/renderer/src/index.js';
import { mountEditor, createDjangoAdapter } from '../packages/editor/src/index.js';
import { createRecoveryStore } from '../packages/editor/src/workspace/recovery.js';
import { createRepeater } from '../packages/editor/src/workspace/data-panel.js';
const tick = () => new Promise((r) => setImmediate(r));
const button = (root, label) =>
  [...root.querySelectorAll('button')].find((n) => n.textContent === label);
const dataSource = {
  id: 'products',
  label: 'Products',
  kind: 'collection',
  fields: [
    { path: 'name', type: 'text', label: 'Name' },
    { path: 'base_price', type: 'currency', label: 'Price' },
    { path: 'assetId', type: 'asset', label: 'Image' },
    { path: 'href', type: 'url', label: 'Link' },
  ],
};
function setup(t, options = {}) {
  const w = new Window({ url: 'http://localhost:4173' }),
    host = w.document.createElement('div');
  w.document.body.append(host);
  const document = options.document || createDocument();
  const adapter = { recoveryScope: 'user-tenant-site', ...options.adapter };
  const editor = mountEditor(host, { document, adapter, saveDelay: 60000, ...options });
  t.after(() => {
    editor.destroy();
    return w.happyDOM.abort();
  });
  return { w, host, root: host.shadowRoot, editor, document, adapter };
}

test('responsive edits inherit deterministically, render phone last and reset one property', () => {
  const doc = createDocument(),
    s = doc.children[0];
  s.style = { paddingLeft: 80, padding: 20 };
  s.responsive = { phone: { padding: 12, height: 100 }, tablet: { padding: 60, gap: 30 } };
  assert.deepEqual(effectiveStyle(s, 'phone'), { padding: 12, gap: 30, height: 100 });
  assert.equal(styleOrigin(s, 'gap', 'phone'), 'tablet');
  const html = renderPage(doc, {}).html;
  assert.ok(html.indexOf('@media(max-width:960px)') < html.indexOf('@media(max-width:600px)'));
  assert.match(html, /padding:20px;padding-left:80px/);
  assert.match(html, /@media\(max-width:600px\).*height:100px/);
  const next = applyOperation(doc, {
    type: 'reset-style',
    id: s.id,
    breakpoint: 'phone',
    property: 'padding',
  }).document;
  assert.equal(effectiveStyle(next.children[0], 'phone').padding, 60);
  assert.equal(next.children[0].responsive.phone.height, 100);
  const spacer = node('spacer');
  spacer.responsive.phone = { height: 123 };
  const sp = renderPage({ ...createDocument(), children: [spacer] }, {}).html;
  assert.ok(sp.indexOf('height:40px') < sp.indexOf('height:123px'));
  assert.ok(!sp.includes('style="height:40px"'));
});

test('contrast uses actual small heading scale and resolves button backgrounds', () => {
  const d = createDocument();
  d.theme.baseSize = 12;
  d.theme.scale = 1;
  const h = node('heading', { text: 'Small', level: 1 });
  h.style.color = '#777777';
  d.children = [h];
  assert.equal(contrastFindings(d)[0].required, 4.5);
  assert.equal(
    checkContrast({ foreground: '#777777', background: '#ffffff', fontSize: 12 }).status,
    'fail',
  );
  const a = node('button', { text: 'Go', href: '/' });
  a.style.backgroundColor = 'primary';
  d.children = [a];
  assert.deepEqual(contrastFindings(d), []);
});

test('repeater renders live fields, safe links, formatted currency, sorting, filtering and bounded pages', () => {
  const repeater = createRepeater(dataSource);
  repeater.props = {
    ...repeater.props,
    sortField: 'base_price',
    sortDirection: 'desc',
    filterField: 'category',
    filterValue: 'shirts',
    limit: 1,
    offset: 1,
  };
  const doc = { ...createDocument(), children: [repeater] },
    data = {
      currency: 'PHP',
      locale: 'en-PH',
      assets: { cover: { url: '/photo.png' } },
      products: [
        { name: 'Low', base_price: '10', category: 'shirts', assetId: 'cover', href: '/low' },
        { name: 'High', base_price: '30', category: 'shirts', href: 'javascript:alert(1)' },
        { name: 'Other', base_price: '40', category: 'bags', href: '/other' },
      ],
    };
  validateDocument(doc);
  const html = renderPage(doc, data).html;
  assert.ok(html.includes('Low'));
  assert.ok(!html.includes('High'));
  assert.ok(!html.includes('Other'));
  assert.match(html, /₱10\.00/);
  assert.ok(html.includes('href="/low"'));
  assert.ok(html.includes('src="/photo.png"'));
  repeater.props.offset = 0;
  const changed = renderPage(doc, data).html;
  assert.ok(changed.includes('High'));
  assert.ok(!changed.includes('href="javascript:'));
  const empty = renderPage(doc, { products: [] }).html;
  assert.ok(empty.includes('Nothing to show yet.'));
  const loading = renderPage(doc, {
    products: [],
    collectionStates: { products: { status: 'loading' } },
  }).html;
  assert.ok(loading.includes('Loading content'));
  data.products[1].name = 'Updated record';
  assert.ok(renderPage(doc, data).html.includes('Updated record'));
});

test('linked instances have separate styles and immutable supplied review data; locked content cannot be mutated', () => {
  const section = (text) => node('section', { name: 'Banner' }, [node('heading', { text })]);
  const a = node('global-section', { sectionId: 'source' }, [section('fallback')]),
    b = node('global-section', { sectionId: 'source2' }, [section('fallback2')]);
  a.id = 'a'.repeat(75) + 'x';
  b.id = 'a'.repeat(75) + 'y';
  const first = section('Live version'),
    second = section('Second');
  first.style.color = '#112233';
  second.style.color = '#334455';
  const doc = { ...createDocument(), children: [a, b, node('text', { text: 'Local' })] },
    frozen = { globalSections: { source: { node: first }, source2: { node: second } } };
  const html = renderPage(doc, frozen, { mode: 'review' }).html;
  assert.ok(html.includes('Live version'));
  assert.ok(!html.includes('fallback'));
  assert.ok(html.includes('#112233'));
  assert.ok(html.includes('#334455'));
  const ids = [...html.matchAll(/<[^>]+data-wb-part="([^"]+)"/g)].map((n) => n[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.throws(
    () => applyOperation(doc, { type: 'move', id: doc.children[2].id, parentId: a.children[0].id }),
    /linked/,
  );
  assert.throws(
    () => applyOperation(doc, { type: 'props', id: a.children[0].id, value: { name: 'changed' } }),
    /shared source/,
  );
});

test('repeaters produce unique section anchors and reject repeated operational widgets', () => {
  const repeater = createRepeater(dataSource);
  repeater.children[0].type = 'section';
  repeater.children[0].props.name = 'Card';
  const d = { ...createDocument(), children: [repeater] },
    html = renderPage(d, { products: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }).html;
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((n) => n[1]);
  assert.equal(ids.length, new Set(ids).size);
  repeater.children[0].children.push(node('widget', { widgetId: 'pixelcore.event-rsvp' }));
  assert.throws(() => validateDocument(d), /operational/);
});

test('old unresolved recovery survives new saves and can be reopened and exported', async (t) => {
  const w = new Window({ url: 'http://localhost:4173' }),
    doc = createDocument();
  w.URL.createObjectURL = undefined;
  const pending = structuredClone(doc);
  pending.title = 'Recovered earlier';
  const store = createRecoveryStore({ storage: w.localStorage, scope: 'scope', websiteId: doc.id });
  store.write(pending, 0);
  const host = w.document.createElement('div');
  w.document.body.append(host);
  let exported;
  const editor = mountEditor(host, {
    document: doc,
    version: 1,
    saveDelay: 60000,
    onExport: (d) => (exported = d),
    adapter: { recoveryScope: 'scope', saveDraft: async (_d, v) => ({ version: v + 1 }) },
  });
  t.after(() => {
    editor.destroy();
    return w.happyDOM.abort();
  });
  button(host.shadowRoot, 'Decide later').click();
  editor.command({ type: 'document', value: { title: 'Current work' } });
  await editor.save();
  assert.equal(store.read().entry.document.title, 'Recovered earlier');
  button(host.shadowRoot, 'Recover').click();
  button(host.shadowRoot, 'Export recovery JSON').click();
  await tick();
  assert.equal(exported.title, 'Recovered earlier');
});

test('earlier autosave does not clear recovery for newer inline typing', async (t) => {
  let finish;
  const { root, editor, document, w } = setup(t, {
    adapter: { recoveryScope: 'scope', saveDraft: () => new Promise((r) => (finish = r)) },
  });
  const store = createRecoveryStore({
    storage: w.localStorage,
    scope: 'scope',
    websiteId: document.id,
  });
  editor.command({ type: 'document', value: { title: 'First change' } });
  const saving = editor.save();
  const fd = root.querySelector('iframe').contentDocument,
    h = fd.querySelector('h1');
  h.dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true }));
  h.textContent = 'Typing during save';
  h.dispatchEvent(new w.Event('input', { bubbles: true }));
  finish({ version: 1 });
  await saving;
  assert.equal(
    store.read().entry.document.children[0].children[0].props.text,
    'Typing during save',
  );
  assert.equal(store.read().entry.baseVersion, 1);
});

test('mounted Data and Shared controls connect real cards and keep linked settings locked', async (t) => {
  const { root, editor, document } = setup(t, {
    data: { products: [{ name: 'Real data', base_price: '25' }] },
    adapter: {
      dataSources: [dataSource],
      listGlobalSections: async () => [],
      createGlobalSection: async () => ({}),
    },
  });
  root.querySelector('[data-tool=data]').click();
  button(root, 'Insert products cards').click();
  assert.equal(
    editor.getDocument().children[0].children.at(-1)?.type === 'repeater' ||
      editor.getDocument().children.at(-1).type === 'repeater',
    true,
  );
  root.querySelector('[data-tool=globals]').click();
  await tick();
  assert.match(root.querySelector('.tool-dialog').textContent, /No shared sections yet/);
  assert.equal(button(root, 'Create from selected section').disabled, true);
  editor.select(document.children[0].id);
  root.querySelector('[data-tool=globals]').click();
  assert.equal(button(root, 'Create from selected section').disabled, false);
});

test('canvas save shortcut reaches pending saves and failed publish remains open', async (t) => {
  let saves = 0;
  const { root, editor, document, w } = setup(t, {
    adapter: {
      saveDraft: async (_d, v) => {
        saves++;
        return { version: v + 1 };
      },
      publish: async () => {
        throw new Error('Try again');
      },
    },
  });
  editor.command({ type: 'text', id: document.children[0].children[0].id, value: 'Changed' });
  const event = new w.KeyboardEvent('keydown', {
    key: 's',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  root.querySelector('iframe').contentDocument.querySelector('h1').dispatchEvent(event);
  await tick();
  assert.equal(saves, 1);
  assert.equal(event.defaultPrevented, true);
  button(root, 'Publish').click();
  button(root.querySelector('dialog'), 'Publish').click();
  await tick();
  assert.match(root.querySelector('dialog [role=alert]').textContent, /Try again/);
});

test('explicit logout cleanup removes only builder recovery documents', () => {
  const w = new Window();
  w.localStorage.setItem('other-app', 'preserve');
  w.localStorage.setItem('sitebuilder:recovery:v1:scope:page', 'data');
  assert.equal(clearRecoveryCopies(w.localStorage), true);
  assert.equal(w.localStorage.getItem('other-app'), 'preserve');
  assert.equal(w.localStorage.length, 1);
});

test('new adapter APIs use version checks through existing authenticated transport', async () => {
  const calls = [],
    revision = { id: 'r', document: createDocument() },
    section = { id: 'g', version: 1 };
  const adapter = createDjangoAdapter({
    websiteId: 'site',
    request: async (path, options) => {
      calls.push({ path, options });
      return {
        revisions: [],
        revision,
        sections: [],
        section,
        version: 2,
        document: revision.document,
      };
    },
  });
  await adapter.listRevisions();
  assert.deepEqual(await adapter.readRevision('r'), revision);
  await adapter.restoreRevision('r', 1);
  await adapter.createGlobalSection('Banner', node('section'));
  await adapter.saveGlobalSection('g', { node: node('section'), expectedVersion: 1 });
  await adapter.publishGlobalSection('g', 1);
  assert.equal(calls.at(-1).options.body.expectedVersion, 1);
  assert.ok(
    calls.some(
      (c) => c.path.endsWith('/revisions/r/restore/') && c.options.body.expectedVersion === 1,
    ),
  );
});

test('inflight saves cannot recreate recovery after editor teardown or logout', async (t) => {
  let finish;
  const { editor, document, w } = setup(t, {
    adapter: {
      recoveryScope: 'scope',
      saveDraft: () => new Promise((resolve) => (finish = resolve)),
    },
  });
  const store = createRecoveryStore({
    storage: w.localStorage,
    scope: 'scope',
    websiteId: document.id,
  });
  editor.command({ type: 'document', value: { title: 'First' } });
  const saving = editor.save();
  editor.command({ type: 'document', value: { title: 'Second' } });
  w.dispatchEvent(new w.Event('sitebuilder:session-ended'));
  clearRecoveryCopies(w.localStorage);
  finish({ version: 1 });
  await saving;
  assert.equal(store.read().reason, 'missing');
  assert.equal(editor.command({ type: 'document', value: { title: 'After logout' } }), false);
  assert.equal(store.read().reason, 'missing');
});
