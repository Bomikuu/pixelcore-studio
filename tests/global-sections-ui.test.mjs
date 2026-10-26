import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import {
  createDocument,
  createHistory,
  node,
  validateDocument,
} from '../packages/core/src/index.js';
import {
  createGlobalReference,
  openGlobalSectionEditor,
  renderGlobalSections,
} from '../packages/editor/src/workspace/global-sections.js';

const shared = () => ({
  id: 'shared-banner',
  name: 'Contact banner',
  version: 3,
  draftVersion: 2,
  publishedVersion: 1,
  node: node('section', { name: 'Contact banner' }, [
    node('heading', { text: 'Get in touch', level: 2 }),
  ]),
  affectedPages: [
    { id: 'site-one', key: 'landing', title: 'Landing page' },
    { id: 'site-two', key: 'event', title: 'Wedding website' },
  ],
});
function setup(section = shared()) {
  const w = new Window({ url: 'http://localhost:4173' });
  const host = w.document.createElement('div');
  w.document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const panel = w.document.createElement('aside');
  root.append(panel);
  const document = createDocument();
  const history = createHistory(document);
  const calls = { save: [], publish: [], create: [], inserted: [], changed: [], reports: [] };
  const ctx = {
    d: w.document,
    root,
    panel,
    history,
    selectedId: history.document.children[0].id,
    data: {},
    adapter: {
      listGlobalSections: async () => [section],
      readGlobalSection: async () => structuredClone(section),
      createGlobalSection: async (name, node) => {
        calls.create.push({ name, node });
        return { ...section, name, node };
      },
      saveGlobalSection: async (id, value) => {
        calls.save.push({ id, value });
        return {
          ...section,
          version: section.version + 1,
          draftVersion: section.draftVersion + 1,
          ...value,
        };
      },
      publishGlobalSection: async (id, expectedVersion) => {
        calls.publish.push({ id, expectedVersion });
        return { ...section, version: section.version + 1, publishedVersion: section.draftVersion };
      },
    },
    report: (...args) => calls.reports.push(args),
    command: (op) => history.apply(op),
    insertNode: (value) => calls.inserted.push(value),
    onGlobalsChanged: async (value) => calls.changed.push(value),
  };
  return { w, root, panel, history, calls, ctx, section };
}
const button = (root, label) =>
  [...root.querySelectorAll('button')].find((control) => control.textContent === label);
async function settle() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
function change(w, root, label, value) {
  const text = [...root.querySelectorAll('label')].find((entry) => entry.textContent === label);
  const control = root.querySelector(`[id="${text.getAttribute('for')}"]`);
  control.value = value;
  control.dispatchEvent(new w.Event('change'));
}

test('shared references copy a valid fallback while retaining source identity and prohibiting recursion', () => {
  const section = shared();
  const a = createGlobalReference(section),
    b = createGlobalReference(section);
  assert.equal(a.props.sectionId, section.id);
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.children[0].id, section.node.id);
  a.children[0].children[0].props.text = 'Independent fallback';
  assert.equal(section.node.children[0].props.text, 'Get in touch');
  validateDocument({ ...createDocument(), children: [b] });
  section.node.children.push(a);
  assert.throws(() => createGlobalReference(section), /cannot contain linked sections/);
});

test('shared panel lists version and page impact, then inserts a link without saving or publishing', async () => {
  const { w, root, ctx, calls } = setup();
  await renderGlobalSections(ctx).ready;
  assert.match(root.textContent, /Draft v2 · Live v1/);
  assert.match(root.textContent, /2 linked pages/);
  button(root, 'Link Contact banner').click();
  assert.equal(calls.inserted[0].type, 'global-section');
  assert.equal(calls.save.length, 0);
  assert.equal(calls.publish.length, 0);
  w.happyDOM.abort();
});

test('creating a source keeps the selected local section independent and validates its name', async () => {
  const { w, root, ctx, calls, history } = setup();
  const original = structuredClone(history.document);
  await renderGlobalSections(ctx).ready;
  button(root, 'Create from selected section').click();
  change(w, root, 'Section name', 'Reusable introduction');
  button(root, 'Create shared section').click();
  await settle();
  assert.equal(calls.create[0].name, 'Reusable introduction');
  assert.notEqual(calls.create[0].node.id, original.children[0].id);
  assert.deepEqual(history.document, original);
  assert.equal(calls.inserted.length, 0);
  assert.equal(calls.publish.length, 0);
  w.happyDOM.abort();
});

test('detaching resolves the current shared draft and produces one undoable local replacement', async () => {
  const { w, root, ctx, history, section } = setup();
  const linked = createGlobalReference(section);
  linked.children[0].children[0].props.text = 'Old fallback';
  history.replace({ ...createDocument(), children: [linked] });
  ctx.selectedId = linked.id;
  const before = structuredClone(history.document);
  await renderGlobalSections(ctx).ready;
  button(root, 'Detach selected link').click();
  await settle();
  assert.equal(history.document.children[0].type, 'section');
  assert.equal(history.document.children[0].children[0].props.text, 'Get in touch');
  assert.notEqual(history.document.children[0].id, section.node.id);
  history.undo();
  assert.deepEqual(history.document, before);
  w.happyDOM.abort();
});

test('isolated section editing saves through optimistic version checks without publishing page drafts', async () => {
  const { w, root, ctx, calls, history, section } = setup();
  const before = structuredClone(history.document);
  let options, local;
  let destroyed = false;
  ctx.mountSectionEditor = (_host, input) => {
    options = input;
    local = structuredClone(input.document);
    return {
      getDocument: () => local,
      destroy: () => {
        destroyed = true;
      },
    };
  };
  await openGlobalSectionEditor(ctx, section);
  assert.equal(options.adapter.publish, undefined);
  assert.equal(options.adapter.recoveryKey, undefined);
  assert.equal(options.adapter.createReview, undefined);
  local.children[0].children[0].props.text = 'Updated shared content';
  options.onChange(local);
  button(root, 'Save shared draft').click();
  await settle();
  assert.equal(calls.save.length, 1);
  assert.equal(calls.save[0].value.expectedVersion, 3);
  assert.equal(calls.save[0].value.node.children[0].props.text, 'Updated shared content');
  assert.equal(calls.publish.length, 0);
  assert.equal(destroyed, true);
  assert.deepEqual(history.document, before);
  assert.equal(root.querySelector('dialog'), null);
  w.happyDOM.abort();
});

test('shared editor keeps failed drafts open and requires confirmation before discarding edits', async () => {
  const { w, root, ctx, section } = setup();
  let local,
    options,
    destroyed = false;
  ctx.adapter.saveGlobalSection = async () => {
    throw new Error('A newer shared draft exists.');
  };
  ctx.mountSectionEditor = (_host, input) => {
    options = input;
    local = structuredClone(input.document);
    return {
      getDocument: () => local,
      destroy: () => {
        destroyed = true;
      },
    };
  };
  await openGlobalSectionEditor(ctx, section);
  local.children[0].children[0].props.text = 'Retain these edits';
  options.onChange(local);
  button(root, 'Save shared draft').click();
  await settle();
  assert.match(root.textContent, /A newer shared draft exists/);
  assert.equal(destroyed, false);
  button(root, 'Close').click();
  assert.equal(root.querySelectorAll('dialog').length, 2);
  button(root, 'Cancel').click();
  assert.equal(root.querySelectorAll('dialog').length, 1);
  assert.equal(destroyed, false);
  button(root, 'Close').click();
  button(root, 'Discard edits').click();
  await settle();
  assert.equal(root.querySelectorAll('dialog').length, 0);
  assert.equal(destroyed, true);
  w.happyDOM.abort();
});

test('global publish shows affected pages, retains errors for retry and never saves the page', async () => {
  const { w, root, ctx, calls, history } = setup();
  const before = structuredClone(history.document);
  let fail = true;
  ctx.adapter.publishGlobalSection = async (id, expectedVersion) => {
    calls.publish.push({ id, expectedVersion });
    if (fail) throw new Error('Version conflict. Refresh the section before publishing.');
    return shared();
  };
  await renderGlobalSections(ctx).ready;
  button(root, 'Publish Contact banner').click();
  assert.match(root.querySelector('dialog').textContent, /Landing page/);
  assert.match(root.querySelector('dialog').textContent, /Wedding website/);
  assert.match(root.querySelector('dialog').textContent, /does not publish any page drafts/);
  assert.equal(calls.publish.length, 0);
  button(root, 'Publish shared section').click();
  await settle();
  assert.match(root.querySelector('dialog').textContent, /Version conflict/);
  fail = false;
  button(root, 'Publish shared section').click();
  await settle();
  assert.equal(calls.publish[1].expectedVersion, 3);
  assert.equal(calls.save.length, 0);
  assert.deepEqual(history.document, before);
  assert.equal(root.querySelector('dialog'), null);
  w.happyDOM.abort();
});

test('host absence and failed list requests provide usable empty and retry states', async () => {
  const { w, root, ctx } = setup();
  ctx.adapter = {};
  await renderGlobalSections(ctx).ready;
  assert.match(root.textContent, /not available in this host/);
  assert.equal(button(root, 'Create from selected section').disabled, true);
  ctx.adapter = {
    listGlobalSections: async () => {
      throw new Error('Connection unavailable.');
    },
  };
  await renderGlobalSections(ctx).ready;
  assert.match(root.textContent, /Connection unavailable/);
  assert.ok(button(root, 'Retry loading shared sections'));
  w.happyDOM.abort();
});

test('pending shared saves block duplicate submissions and accidental Escape dismissal', async () => {
  const { w, root, ctx, section, calls } = setup();
  let finish;
  ctx.adapter.saveGlobalSection = async (id, value) => {
    calls.save.push({ id, value });
    return new Promise((resolve) => {
      finish = () => resolve(section);
    });
  };
  ctx.mountSectionEditor = (_host, options) => ({
    getDocument: () => options.document,
    destroy() {},
  });
  await openGlobalSectionEditor(ctx, section);
  const save = button(root, 'Save shared draft');
  save.click();
  save.click();
  assert.equal(calls.save.length, 1);
  assert.equal(save.disabled, true);
  const dialog = root.querySelector('dialog');
  const escape = new w.Event('cancel', { cancelable: true });
  dialog.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(root.querySelector('dialog'), dialog);
  finish();
  await settle();
  assert.equal(root.querySelector('dialog'), null);
  w.happyDOM.abort();
});

test('late source lists do not append stale controls after the panel changes', async () => {
  const { w, root, ctx, panel, section } = setup();
  let finish;
  ctx.adapter.listGlobalSections = async () =>
    new Promise((resolve) => {
      finish = () => resolve([section]);
    });
  const loading = renderGlobalSections(ctx);
  panel.replaceChildren(w.document.createTextNode('Different panel'));
  finish();
  await loading.ready;
  assert.equal(panel.textContent, 'Different panel');
  assert.equal(button(root, 'Link Contact banner'), undefined);
  w.happyDOM.abort();
});

test('an unavailable source can be detached as an explicitly confirmed saved copy', async () => {
  const { w, root, ctx, history, section } = setup();
  const linked = createGlobalReference(section);
  history.replace({ ...history.document, children: [linked] });
  ctx.selectedId = linked.id;
  ctx.adapter.readGlobalSection = async () => {
    throw new Error('Source unavailable');
  };
  await renderGlobalSections(ctx).ready;
  button(root, 'Detach selected link').click();
  await settle();
  assert.equal(history.document.children[0].type, 'global-section');
  button(root, 'Use saved copy').click();
  await settle();
  assert.equal(history.document.children[0].type, 'section');
  history.undo();
  assert.equal(history.document.children[0].type, 'global-section');
  w.happyDOM.abort();
});
