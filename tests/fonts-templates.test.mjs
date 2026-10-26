import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import {
  createDocument,
  node,
  normalizeGlobalFonts,
  createHistory,
  applyOperation,
  createTemplate,
  parseTemplateJSON,
} from '../packages/core/src/index.js';
import { renderPage } from '../packages/renderer/src/index.js';
import { mountEditor, createDjangoAdapter } from '../packages/editor/src/index.js';
import { openLibrary } from '../packages/editor/src/library/dialog.js';
const button = (root, label) =>
  [...root.querySelectorAll('button')].find((n) => n.textContent === label);
const control = (root, label) => {
  const el = [...root.querySelectorAll('label')].find((n) => n.textContent === label);
  return root.querySelector(`[id="${el.htmlFor}"]`);
};
function dom(t) {
  const w = new Window({ url: 'http://localhost:4173' });
  const host = w.document.createElement('div');
  w.document.body.append(host);
  t.after(() => w.happyDOM.abort());
  return { w, host };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
function chooseFile(w, root, contents, name = 'template.json') {
  const input = root.querySelector('input[type=file]');
  Object.defineProperty(input, 'files', {
    value: [new w.File([contents], name, { type: 'application/json' })],
    configurable: true,
  });
  input.dispatchEvent(new w.Event('change'));
}

test('global font policy normalizes legacy overrides without changing their source and rejects new local families', () => {
  const doc = createDocument();
  doc.style.fontFamily = 'Arial';
  const heading = doc.children[0].children[0];
  heading.style.fontFamily = 'Verdana';
  heading.responsive.phone = { fontFamily: 'Trebuchet MS', fontSize: 30 };
  const normalized = normalizeGlobalFonts(doc);
  assert.equal(doc.style.fontFamily, 'Arial');
  assert.equal(normalized.style.fontFamily, undefined);
  assert.deepEqual(normalized.children[0].children[0].responsive.phone, { fontSize: 30 });
  const history = createHistory(doc);
  for (const breakpoint of ['desktop', 'tablet', 'phone'])
    assert.throws(
      () =>
        history.apply({
          type: 'style',
          id: heading.id,
          breakpoint,
          value: { fontFamily: 'Arial' },
        }),
      /globally/,
    );
  history.apply({
    type: 'theme',
    value: { headingFont: 'Cormorant Garamond', bodyFont: 'Georgia' },
  });
  assert.equal(history.document.theme.headingFont, 'Cormorant Garamond');
  history.undo();
  assert.deepEqual(history.document, normalized);
  const html = renderPage(doc, {}).html;
  assert.ok(!/font-family:(Arial|Verdana|Trebuchet MS)/.test(html));
  assert.ok(html.includes('.wb-page h6{font-family:var(--wb-heading-font)'));
  const inserted = node('text', { text: 'Legacy section' });
  inserted.style.fontFamily = 'Arial';
  assert.equal(
    applyOperation(doc, { type: 'insert', id: doc.id, node: inserted }).document.children.at(-1)
      .style.fontFamily,
    undefined,
  );
});

test('selected element has no font family selector; Theme & branding updates the global pair', (t) => {
  const { w, host } = dom(t),
    doc = createDocument();
  const editor = mountEditor(host, { document: doc, adapter: {} });
  const root = host.shadowRoot;
  editor.select(doc.children[0].children[0].id);
  const inspector = root.querySelector('.inspector');
  assert.match(inspector.textContent, /Primary font · Georgia/);
  assert.ok(
    ![...inspector.querySelectorAll('label')].some((n) =>
      /font.*(family|headings|body)/i.test(n.textContent),
    ),
  );
  assert.ok(control(inspector, 'Font size'));
  root.querySelector('[data-tool=brand]').click();
  const primary = control(root.querySelector('.tool-dialog'), 'Primary font (headings)');
  primary.value = 'Cormorant Garamond';
  primary.dispatchEvent(new w.Event('change'));
  const secondary = control(root.querySelector('.tool-dialog'), 'Secondary font (body)');
  secondary.value = 'Arial';
  secondary.dispatchEvent(new w.Event('change'));
  assert.equal(editor.getDocument().theme.headingFont, 'Cormorant Garamond');
  assert.equal(editor.getDocument().theme.bodyFont, 'Arial');
  assert.match(root.querySelector('.inspector').textContent, /Primary font · Cormorant Garamond/);
  editor.destroy();
});

test('template JSON roundtrips exports, strips source context and rejects unsupported or executable documents', () => {
  const doc = createDocument();
  doc.context = { version: 1, purpose: 'landing', sourceId: 'original-page', setupComplete: 1 };
  doc.children[0].style.fontFamily = 'Arial';
  const value = createTemplate({
    name: '  Seasonal page  ',
    description: 'A reusable page',
    document: doc,
  });
  const imported = parseTemplateJSON(JSON.stringify(value));
  assert.deepEqual(imported, value);
  assert.equal(imported.name, 'Seasonal page');
  assert.equal(imported.document.context, undefined);
  assert.equal(imported.document.children[0].style.fontFamily, undefined);
  assert.equal(doc.context.sourceId, 'original-page');
  assert.equal(parseTemplateJSON(JSON.stringify(doc)).name, doc.title);
  for (const text of ['{oops', '{"version":2}', 'x'.repeat(550001)])
    assert.throws(() => parseTemplateJSON(text));
  const extra = structuredClone(value);
  extra.document.dataSnapshot = { guest: 'private' };
  assert.throws(
    () => parseTemplateJSON(JSON.stringify(extra)),
    /Unsupported template document field/,
  );
  const executable = structuredClone(value);
  executable.document.children[0].props.html = '<script>';
  assert.throws(() => parseTemplateJSON(JSON.stringify(executable)), /Unsupported property/);
  const duplicate = structuredClone(value);
  duplicate.document.children.push(duplicate.document.children[0]);
  assert.throws(() => parseTemplateJSON(JSON.stringify(duplicate)), /duplicate/);
});

test('Add template saves to the library, export roundtrips and creation never edits the page', async (t) => {
  const { host } = dom(t),
    root = host.attachShadow({ mode: 'open' }),
    doc = createDocument();
  let saved,
    exported,
    applied = 0;
  const library = openLibrary({
    root,
    kind: 'templates',
    document: doc,
    onChoose: () => applied++,
    onExportTemplate: (value) => (exported = value),
    onSaveTemplate: async (name, document, description) =>
      (saved = { id: 'saved', name, document, description }),
  });
  button(root, 'Add template').click();
  control(root, 'Template name').value = 'My starter';
  button(root, 'Save template').click();
  await tick();
  assert.equal(saved.name, 'My starter');
  assert.equal(applied, 0);
  assert.ok(root.querySelector('[aria-label="Preview My starter"]'));
  button(root, 'Export template JSON').click();
  assert.equal(parseTemplateJSON(JSON.stringify(exported)).name, 'My starter');
  library.close();
  openLibrary({
    root,
    kind: 'templates',
    document: doc,
    savedTemplates: [saved],
    onChoose: () => applied++,
  });
  button(root, 'My templates').click();
  assert.ok(root.querySelector('[aria-label="Preview My starter"]'));
  assert.equal(applied, 0);
});

test('JSON file import reports errors, previews a valid file, and retains inputs after a failed save', async (t) => {
  const { w, host } = dom(t),
    root = host.attachShadow({ mode: 'open' }),
    doc = createDocument();
  let attempts = 0,
    applied = 0;
  openLibrary({
    root,
    kind: 'templates',
    document: doc,
    onChoose: () => applied++,
    onSaveTemplate: async (name, document, description) => {
      if (++attempts === 1) throw new Error('Connection lost. Retry saving.');
      return { id: 'imported', name, document, description };
    },
  });
  button(root, 'Import JSON').click();
  assert.equal(button(root, 'Save template').disabled, true);
  chooseFile(w, root, 'not json');
  await tick();
  assert.match(root.querySelector('.library-detail [role=alert]').textContent, /not valid JSON/);
  assert.equal(button(root, 'Save template').disabled, true);
  const source = createDocument({ title: 'Imported collection' });
  source.theme.headingFont = 'Arial';
  chooseFile(w, root, JSON.stringify(source));
  await tick();
  assert.ok(root.querySelector('iframe[title="Imported collection preview"]'));
  assert.equal(applied, 0);
  control(root, 'Template name').value = 'Chosen name';
  button(root, 'Save template').click();
  await tick();
  assert.match(root.querySelector('.library-detail [role=alert]').textContent, /Connection lost/);
  assert.equal(control(root, 'Template name').value, 'Chosen name');
  assert.equal(button(root, 'Save template').disabled, false);
  button(root, 'Save template').click();
  await tick();
  assert.ok(root.querySelector('[aria-label="Preview Chosen name"]'));
  assert.equal(applied, 0);
  button(root, 'Apply to this page').click();
  assert.equal(applied, 1);
});

test('saved templates respect destination identity, context, fonts, capabilities, host regions and undo', async (t) => {
  const { host } = dom(t),
    doc = createDocument();
  doc.context = { version: 1, purpose: 'landing', sourceId: 'current-page', setupComplete: 1 };
  doc.theme.headingFont = 'Cormorant Garamond';
  doc.theme.bodyFont = 'Verdana';
  const template = createDocument({ title: 'Other page' });
  template.children.unshift(node('header', {}));
  const editor = mountEditor(host, {
    document: doc,
    data: { frame: { owner: 'host', regions: [] } },
    adapter: {
      listTemplates: async () => [{ id: 'template', name: 'My layout', document: template }],
    },
  });
  host.shadowRoot.querySelector('[data-tool=templates]').click();
  await tick();
  button(host.shadowRoot, 'My templates').click();
  host.shadowRoot.querySelector('[aria-label="Preview My layout"]').click();
  const src = host.shadowRoot.querySelector('iframe[title="My layout preview"]').srcdoc;
  assert.match(src, /--wb-heading-font:'Cormorant Garamond'/);
  button(host.shadowRoot, 'Apply to this page').click();
  const result = editor.getDocument();
  assert.equal(result.id, doc.id);
  assert.deepEqual(result.context, doc.context);
  assert.equal(result.theme.headingFont, doc.theme.headingFont);
  assert.equal(result.theme.bodyFont, doc.theme.bodyFont);
  assert.ok(!result.children.some((n) => n.type === 'header'));
  editor.undo();
  assert.deepEqual(editor.getDocument(), doc);
  editor.destroy();
  const widget = node('widget', { widgetId: 'pixelcore.event-rsvp' });
  const root = host.shadowRoot;
  openLibrary({
    root,
    kind: 'templates',
    document: doc,
    capabilities: [],
    savedTemplates: [
      { id: 'rsvp', name: 'Wedding', document: { ...template, children: [widget] } },
    ],
    onChoose: () => assert.fail('Unavailable template applied'),
  });
  button(root, 'My templates').click();
  root.querySelector('[aria-label="Preview Wedding"]').click();
  assert.equal(button(root, 'Apply to this page').disabled, true);
});

test('Django adapter persists named templates through its authenticated transport', async () => {
  const calls = [],
    doc = createDocument();
  const saved = { id: 'saved', name: 'Example', document: doc };
  const adapter = createDjangoAdapter({
    websiteId: 'site',
    request: async (path, options) => {
      calls.push({ path, options });
      return { template: saved, templates: [saved] };
    },
  });
  assert.deepEqual(await adapter.listTemplates(), [saved]);
  assert.deepEqual(await adapter.saveTemplate('Example', doc, 'Intro'), saved);
  assert.equal(calls[0].path, '/api/website-builder/sites/site/templates/');
  assert.deepEqual(calls.at(-1).options, {
    method: 'POST',
    headers: { 'X-CSRFToken': '' },
    body: { name: 'Example', document: doc, description: 'Intro' },
  });
});
