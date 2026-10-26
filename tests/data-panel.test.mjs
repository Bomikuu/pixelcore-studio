import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createDocument, node, validateDocument } from '../packages/core/src/index.js';
import {
  sourceCatalog,
  createRepeater,
  renderDataPanel,
  renderBindings,
  renderCollectionControls,
} from '../packages/editor/src/workspace/data-panel.js';

const catalog = [
  {
    id: 'identity',
    label: 'Business',
    kind: 'record',
    fields: [
      { path: 'name', label: 'Name', type: 'text' },
      { path: 'url', label: 'Website', type: 'url' },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    kind: 'collection',
    fields: [
      { path: 'name', label: 'Name', type: 'text' },
      { path: 'price', label: 'Price', type: 'currency' },
      { path: 'assetId', label: 'Image', type: 'asset' },
      { path: 'url', label: 'Link', type: 'url' },
    ],
  },
];
function setup(selected = node('text', { text: 'Fixed copy' }), overrides = {}) {
  const w = new Window({ url: 'http://localhost:4173' });
  const host = w.document.createElement('div');
  w.document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const panel = w.document.createElement('aside');
  root.append(panel);
  const document = createDocument();
  document.children = [selected];
  const commands = [],
    inserts = [],
    reports = [];
  const ctx = {
    d: w.document,
    root,
    panel,
    history: { document },
    selectedId: selected.id,
    command: (op) => commands.push(op),
    insertNode: (n) => inserts.push(n),
    report: (message) => reports.push(message),
    adapter: { dataSources: catalog },
    data: {
      identity: { name: 'Real shop', url: '/shop' },
      products: [{ name: 'One', price: 19, assetId: 'cover', url: '/one' }, { name: 'Two' }],
    },
    ...overrides,
  };
  return { w, root, panel, commands, inserts, reports, ctx, selected };
}
const button = (root, label) =>
  [...root.querySelectorAll('button')].find((n) => n.textContent === label);
function change(w, root, label, value) {
  const fieldLabel = [...root.querySelectorAll('label')].find((n) => n.textContent === label);
  assert.ok(fieldLabel, `Missing field ${label}`);
  const control = root.querySelector(`[id="${fieldLabel.getAttribute('for')}"]`);
  control.value = value;
  control.dispatchEvent(new w.Event('change'));
  return control;
}

test('catalog never discovers private fields and fallback sources respect capabilities', () => {
  const data = {
    identity: { name: 'Shop', secret: 'private' },
    products: [{ name: 'Visible' }],
    guest: { token: 'private' },
    event: { title: 'Public event', guests: [] },
  };
  const basic = sourceCatalog({}, data);
  assert.deepEqual(
    basic.map((entry) => entry.id),
    ['identity'],
  );
  assert.ok(!JSON.stringify(basic).includes('secret'));
  const enabled = sourceCatalog({ capabilities: ['event', 'products'] }, data);
  assert.ok(enabled.some((entry) => entry.id === 'event.people'));
  assert.ok(!JSON.stringify(enabled).includes('guests'));
  const filtered = sourceCatalog(
    {
      dataSources: [
        ...catalog,
        { id: 'guest', kind: 'record', fields: [{ path: 'token', type: 'text' }] },
        { id: 'clinical.records', kind: 'collection', fields: [{ path: 'name', type: 'text' }] },
        {
          id: 'public',
          kind: 'record',
          fields: [
            { path: '__proto__.value', type: 'text' },
            { path: 'guest_token', type: 'text' },
            { path: 'guestToken', type: 'text' },
            { path: 'title', type: 'text' },
          ],
        },
      ],
    },
    data,
  );
  assert.deepEqual(
    filtered.map((entry) => entry.id),
    ['identity', 'products', 'public'],
  );
  assert.deepEqual(
    filtered.at(-1).fields.map((entry) => entry.path),
    ['title'],
  );
  assert.deepEqual(sourceCatalog({ dataSources: [] }, data), []);
});

test('data panel inserts one editable prototype rather than copying runtime records', () => {
  const { w, ctx, root, inserts } = setup();
  renderDataPanel(ctx);
  assert.match(root.textContent, /2 records/);
  button(root, 'Insert products cards').click();
  assert.equal(inserts.length, 1);
  const repeater = inserts[0];
  assert.equal(repeater.type, 'repeater');
  assert.equal(repeater.props.source, 'products');
  assert.equal(repeater.children.length, 1);
  assert.ok(repeater.children[0].children.some((n) => n.props.text?.source === 'item'));
  assert.ok(repeater.children[0].children.some((n) => n.props.href?.path === 'url'));
  assert.ok(!JSON.stringify(repeater).includes('"One"'));
  assert.equal(repeater.responsive.phone.gridColumns, 1);
  validateDocument({ ...createDocument(), children: [repeater] });
  w.happyDOM.abort();
});

test('binding picker matches targets to field types and requires an explicit connect action', () => {
  const { w, ctx, root, commands, reports } = setup(node('button', { text: 'Visit', href: '#' }));
  renderBindings(ctx, ctx.history.document.children[0]);
  button(root, 'Connect link destination').click();
  assert.equal(commands.length, 0);
  assert.match(reports[0], /Choose a field/);
  const select = change(w, root, 'Connect link destination', JSON.stringify(['identity', 'url']));
  assert.equal(select.options.length, 2);
  assert.equal(commands.length, 0);
  button(root, 'Connect link destination').click();
  assert.deepEqual(commands[0].value, { href: { source: 'identity', path: 'url' } });
  assert.ok(!root.textContent.includes('Business / Website\nBusiness / Name'));
  w.happyDOM.abort();
});

test('card fields use their parent collection and currency formats without exposing other collections', () => {
  const repeater = createRepeater(catalog[1]);
  const selected = repeater.children[0].children.find((n) => n.type === 'text');
  const { w, ctx, root, commands } = setup(repeater);
  renderBindings(ctx, selected);
  change(w, root, 'Connect text', JSON.stringify(['item', 'price']));
  button(root, 'Connect text').click();
  assert.deepEqual(commands[0].value.text, { source: 'item', path: 'price', format: 'currency' });
  assert.match(root.textContent, /Products card \/ Price/);
  assert.ok(!root.textContent.includes('item /'));
  w.happyDOM.abort();
});

test('connected image is detached only after confirmation and retains a scalar value', async () => {
  const selected = node('image', { assetId: { source: 'identity', path: 'cover' }, alt: 'Cover' });
  const { w, ctx, root, commands } = setup(selected, {
    data: { identity: { cover: 'approved-cover' } },
    adapter: {
      dataSources: [
        {
          id: 'identity',
          label: 'Business',
          kind: 'record',
          fields: [{ path: 'cover', label: 'Cover', type: 'asset' }],
        },
      ],
    },
  });
  renderBindings(ctx, selected);
  button(root, 'Detach image').click();
  assert.equal(commands.length, 0);
  button(root, 'Cancel').click();
  assert.equal(commands.length, 0);
  button(root, 'Detach image').click();
  button(root, 'Detach connection').click();
  await Promise.resolve();
  assert.deepEqual(commands[0], {
    type: 'props',
    id: selected.id,
    value: { assetId: 'approved-cover' },
    detach: true,
  });
  w.happyDOM.abort();
});

test('collection controls emit bounded pagination, field-based filters and stable sort operations', () => {
  const selected = createRepeater(catalog[1]);
  const { w, ctx, root, commands } = setup(selected);
  renderCollectionControls(ctx, selected);
  change(w, root, 'Maximum cards', '12');
  change(w, root, 'Skip first records', '2');
  change(w, root, 'Filter field', 'name');
  change(w, root, 'Filter equals', 'Featured');
  change(w, root, 'Sort field', 'price');
  change(w, root, 'Sort direction', 'desc');
  assert.deepEqual(
    commands.map((op) => op.value),
    [
      { limit: 12 },
      { offset: 2 },
      { filterField: 'name' },
      { filterValue: 'Featured' },
      { sortField: 'price' },
      { sortDirection: 'desc' },
    ],
  );
  const maximum = [...root.querySelectorAll('input')].find((n) => n.getAttribute('max') === '50');
  assert.ok(maximum);
  assert.ok(!root.textContent.includes('Image</option>'));
  w.happyDOM.abort();
});

test('unavailable and empty sources have distinct states and never expose resolved private records', () => {
  const { w, ctx, root } = setup(undefined, {
    data: { guest: { token: 'secret-value' }, products: [] },
  });
  renderDataPanel(ctx);
  assert.match(root.textContent, /Source unavailable/);
  assert.match(root.textContent, /0 records/);
  assert.equal(button(root, 'Insert products cards').disabled, false);
  assert.ok(!root.textContent.includes('secret-value'));
  ctx.adapter = { dataSources: [] };
  renderDataPanel(ctx);
  assert.match(root.textContent, /No approved data sources/);
  w.happyDOM.abort();
});
