import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createDocument, node, validateDocument, walk } from '../packages/core/src/index.js';
import { templates, sectionPresets, renderPage } from '../packages/renderer/src/index.js';
import { openLibrary } from '../packages/editor/src/library/dialog.js';
import { openContext } from '../packages/editor/src/workspace/context.js';
import { mountEditor } from '../packages/editor/src/index.js';
const dom = () => {
  const w = new Window({ url: 'http://localhost:4173' });
  const host = w.document.createElement('div');
  w.document.body.append(host);
  return { w, host, root: host.attachShadow({ mode: 'open' }) };
};
const button = (root, text) =>
  [...root.querySelectorAll('button')].find((n) => n.textContent === text);

test('all six templates and section presets validate and render without editor code', () => {
  assert.equal(templates.length, 6);
  assert.ok(sectionPresets.length >= 30);
  for (const entry of [...templates, ...sectionPresets]) {
    const value = entry.create({ assets: {} }),
      document = value.type === 'page' ? value : { ...createDocument(), children: [value] };
    validateDocument(document);
    const html = renderPage(document, {}, { mode: 'review' }).html;
    assert.ok(!html.includes('file:///'));
    assert.ok(!html.includes('packages/editor'));
    walk(document, (n) => {
      if (n.type === 'section') assert.equal(n.responsive.phone.padding, 28);
    });
  }
});

test('library opens visual previews, filters, enforces capabilities and cancels without edits', () => {
  const { root, w } = dom();
  let chosen = 0;
  const library = openLibrary({
    root,
    document: createDocument(),
    capabilities: [],
    onChoose: () => chosen++,
  });
  assert.equal(root.querySelector('dialog').getAttribute('open'), '');
  button(root, 'RSVP').click();
  root.querySelector('[aria-label="Preview RSVP card"]').click();
  assert.equal(button(root, 'Insert design').disabled, true);
  assert.ok(root.querySelector('iframe[title="RSVP card preview"]'));
  assert.equal(chosen, 0);
  library.close();
  assert.equal(root.querySelector('dialog'), null);
  const saved = sectionPresets.find((n) => n.id === 'rsvp-inline').create();
  const again = openLibrary({
    root,
    document: createDocument(),
    capabilities: [],
    saved: [{ name: 'Saved RSVP', node: saved, create: () => saved }],
    onChoose: () => chosen++,
  });
  button(root, 'Saved').click();
  root.querySelector('[aria-label="Preview Saved RSVP"]').click();
  assert.equal(button(root, 'Insert design').disabled, true);
  assert.match(root.textContent, /Requires rsvp connection/);
  again.close();
  w.happyDOM.abort();
});

test('template selection is an undoable page replacement with stable page identity', async () => {
  const { w, host } = dom(),
    document = createDocument();
  const editor = mountEditor(host, {
    document,
    adapter: { capabilities: ['products', 'event', 'rsvp', 'wishes'] },
  });
  host.shadowRoot.querySelector('[data-tool=templates]').click();
  await Promise.resolve();
  host.shadowRoot.querySelector('[aria-label="Preview Landing minimal"]').click();
  button(host.shadowRoot, 'Apply to this page').click();
  assert.equal(editor.getDocument().id, document.id);
  assert.ok(editor.getDocument().children.some((n) => n.type === 'header'));
  editor.undo();
  assert.deepEqual(editor.getDocument(), document);
  editor.destroy();
  w.happyDOM.abort();
});

test('context is prefilled and a complete setup is one draft operation', () => {
  const { root, w } = dom(),
    document = createDocument();
  let result;
  openContext({
    root,
    document,
    workspace: {
      kind: 'event',
      purpose: 'event',
      sourceId: 'event-123',
      sourceName: 'Existing occasion',
      features: ['event', 'rsvp'],
    },
    onApply: (d) => (result = d),
  });
  assert.match(root.textContent, /Existing occasion/);
  assert.equal(root.querySelector('select').value, 'event');
  button(root, 'Continue').click();
  button(root, 'Continue').click();
  button(root, 'Open studio').click();
  assert.equal(result.context.sourceId, 'event-123');
  assert.equal(result.context.setupComplete, 1);
  assert.equal(result.context.purpose, 'event');
  assert.equal(document.context, undefined);
  validateDocument(result);
  w.happyDOM.abort();
});

test('host frame renders once in the canvas and stays outside the public page body', () => {
  const document = templates[0].create();
  const data = {
    identity: { name: 'Real store' },
    frame: {
      owner: 'host',
      regions: [node('header', { variant: 'left' }), node('footer', { variant: 'columns' })],
    },
  };
  const editor = renderPage(document, data, { mode: 'editor' }).html;
  assert.equal((editor.match(/<header /g) || []).length, 1);
  assert.equal((editor.match(/<footer /g) || []).length, 1);
  assert.equal((editor.match(/<main /g) || []).length, 1);
  const publicHtml = renderPage(document, data).html;
  assert.equal((publicHtml.match(/<header /g) || []).length, 0);
  assert.equal((publicHtml.match(/<footer /g) || []).length, 0);
});

test('RSVP is an allowlisted inert widget; guest state never renders in reviews', () => {
  const document = {
    ...createDocument(),
    children: [
      node('widget', { widgetId: 'pixelcore.event-rsvp', variant: 'inline', source: 'event' }),
    ],
  };
  const output = renderPage(
    document,
    {
      event: { title: 'Wedding' },
      guest: { full_name: 'Private guest', dietary_notes: 'Private note', token: 'secret-token' },
    },
    { mode: 'review' },
  );
  assert.equal(output.widgets[0].widgetId, 'pixelcore.event-rsvp');
  assert.match(output.html, /Sample guest/);
  assert.ok(!output.html.includes('<form'));
  assert.ok(!output.html.includes('secret-token'));
  assert.ok(!output.html.includes('Private note'));
  document.children[0].props.widgetId = 'custom.untrusted-script';
  assert.throws(() => validateDocument(document), /Unsupported host widget/);
});

test('template calls to action point to sections that actually exist', () => {
  for (const template of templates) {
    const document = template.create();
    const out = renderPage(document, {}).html;
    walk(document, (n) => {
      if (n.type === 'button' && n.props.href?.startsWith('#') && n.props.href.length > 1)
        assert.ok(
          out.includes(`id="${n.props.href.slice(1)}"`),
          `${template.id}: missing ${n.props.href}`,
        );
    });
  }
});
