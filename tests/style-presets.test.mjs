import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import axe from 'axe-core';
import {
  createDocument,
  node,
  createHistory,
  applyOperation,
  findNode,
  stylePresets,
  matchingStylePreset,
  effectiveStyle,
  contrastFindings,
  schemes,
  validateDocument,
} from '../packages/core/src/index.js';
import { mountEditor } from '../packages/editor/src/index.js';
import { renderPage } from '../packages/renderer/src/index.js';
const families = ['button', 'container', 'image', 'section', 'columns', 'heading', 'text'];
const tick = () => new Promise((resolve) => setImmediate(resolve));
const control = (root, label) => {
  const l = [...root.querySelectorAll('label')].find((n) => n.textContent === label);
  assert.ok(l, `Missing ${label}`);
  return root.querySelector(`[id="${l.htmlFor}"]`);
};
function setup(t, document = createDocument()) {
  const w = new Window({
    url: 'http://localhost:4173',
    settings: {
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
  });
  const host = w.document.createElement('div');
  w.document.body.append(host);
  const editor = mountEditor(host, { document, adapter: {}, saveDelay: 60000 });
  t.after(async () => {
    editor.destroy();
    await w.happyDOM.abort();
  });
  return { w, root: host.shadowRoot, editor, document };
}

test('every illustrated preset expands into a valid ordinary style across themes and breakpoints', () => {
  let count = 0;
  for (const scheme of schemes)
    for (const type of families) {
      const doc = createDocument();
      doc.theme.colors = scheme.colors;
      const element = node(type, type === 'heading' ? { level: 2 } : {});
      doc.children = [element];
      for (const preset of stylePresets(type, doc.theme))
        for (const breakpoint of ['desktop', 'tablet', 'phone']) {
          const changed = applyOperation(doc, {
            type: 'style-preset',
            id: element.id,
            preset: preset.id,
            breakpoint,
          }).document;
          validateDocument(changed);
          const updated = changed.children[0];
          assert.equal(matchingStylePreset(updated, changed.theme, breakpoint), preset.id);
          assert.equal(updated.props.fontFamily, undefined);
          assert.equal(effectiveStyle(updated, breakpoint).fontFamily, undefined);
          const html = renderPage(changed).html;
          assert.ok(!html.includes('undefined') && !html.includes('editor/src'));
          assert.deepEqual(element.style, {});
          count++;
        }
    }
  assert.ok(count >= 300);
});

test('preset application replaces only its appearance, retains data, layout and device overrides, and undoes once', () => {
  const doc = createDocument({ mode: 'live' });
  const element = doc.children[0].children[2];
  element.props = {
    text: { source: 'event', path: 'title' },
    href: { source: 'event', path: 'url' },
  };
  element.style = {
    background: { type: 'gradient', from: '#ffffff', to: '#000000' },
    padding: 60,
    width: 75,
    display: 'none',
    motion: { preset: 'fade', duration: 400, delay: 0 },
  };
  element.responsive = {
    tablet: { borderRadius: 3, paddingLeft: 8 },
    phone: { width: 100, paddingRight: 5 },
  };
  const history = createHistory(doc);
  history.apply({ type: 'style-preset', id: element.id, preset: 'outline' });
  const result = findNode(history.document, element.id);
  assert.deepEqual(result.props, element.props);
  assert.deepEqual(result.responsive, element.responsive);
  assert.equal(result.style.width, 75);
  assert.equal(result.style.display, 'none');
  assert.deepEqual(result.style.motion, element.style.motion);
  assert.equal(result.style.padding, undefined);
  assert.equal(result.style.background, undefined);
  assert.equal(result.style.backgroundColor, 'transparent');
  history.undo();
  assert.deepEqual(history.document, doc);
  assert.equal(history.canUndo, false);
  history.redo();
  assert.equal(findNode(history.document, element.id).style.borderWidth, 1);
});

test('responsive presets reset inherited media backgrounds and remain custom after detailed overrides', () => {
  const doc = createDocument();
  const element = doc.children[0].children[2];
  element.style = { background: { type: 'image', assetId: 'hero' }, paddingLeft: 50 };
  let changed = applyOperation(doc, {
    type: 'style-preset',
    id: element.id,
    preset: 'text-link',
    breakpoint: 'tablet',
  }).document;
  let updated = findNode(changed, element.id);
  assert.deepEqual(updated.style, element.style);
  assert.equal(effectiveStyle(updated, 'phone').background, undefined);
  assert.equal(effectiveStyle(updated, 'phone').backgroundColor, 'transparent');
  assert.equal(effectiveStyle(updated, 'phone').paddingLeft, 0);
  const output = renderPage(changed, { assets: { hero: { url: '/hero.jpg' } } }).html;
  assert.match(output, /@media\(max-width:960px\)[^}]+background:transparent/);
  changed = applyOperation(changed, {
    type: 'style',
    id: element.id,
    breakpoint: 'tablet',
    value: { background: { type: 'solid', color: '#eeeeee' } },
  }).document;
  updated = findNode(changed, element.id);
  assert.equal(updated.responsive.tablet.backgroundColor, undefined);
  assert.equal(matchingStylePreset(updated, changed.theme, 'tablet'), null);
  const card = node('container');
  changed.children.push(card);
  changed = applyOperation(changed, {
    type: 'style-preset',
    id: card.id,
    preset: 'filled',
  }).document;
  changed = applyOperation(changed, {
    type: 'style',
    id: card.id,
    value: { paddingTop: 3 },
  }).document;
  assert.equal(matchingStylePreset(findNode(changed, card.id), changed.theme), null);
});

test('transparent buttons use their actual ancestor backdrop for contrast, including indeterminate images', () => {
  const doc = createDocument();
  const button = doc.children[0].children[2];
  const changed = applyOperation(doc, {
    type: 'style-preset',
    id: button.id,
    preset: 'outline',
  }).document;
  changed.theme.colors.primary = '#ffffff';
  assert.equal(contrastFindings(changed).find((f) => f.nodeId === button.id).status, 'fail');
  changed.children[0].style.background = { type: 'image', assetId: 'hero' };
  assert.equal(
    contrastFindings(changed).find((f) => f.nodeId === button.id).status,
    'needs-review',
  );
});

test('preset colors stay connected to branding and borders/shadows use bounded public CSS', () => {
  let doc = createDocument();
  const button = doc.children[0].children[2];
  doc = applyOperation(doc, {
    type: 'style-preset',
    id: button.id,
    preset: 'outline-pill',
  }).document;
  doc.theme.colors.primary = '#802233';
  const card = node('container');
  doc.children[1].children.push(card);
  doc = applyOperation(doc, { type: 'style-preset', id: card.id, preset: 'elevated' }).document;
  const html = renderPage(doc).html;
  assert.ok(
    html.includes('border-color:#802233') &&
      html.includes('border-width:1px') &&
      html.includes('border-radius:200px'),
  );
  assert.ok(html.includes('box-shadow:0 4px 16px #00000014'));
  assert.ok(!html.includes('box-shadow:soft'));
});

test('unsupported presets and executable or unbounded custom appearance are rejected without mutating the source', () => {
  const doc = createDocument(),
    element = doc.children[0].children[2];
  for (const op of [
    { type: 'style-preset', preset: 'elevated' },
    { type: 'style-preset', preset: 'rounded', breakpoint: 'watch' },
    ...[
      { borderWidth: -1 },
      { borderWidth: 13 },
      { borderColor: 'red;display:none' },
      { boxShadow: 'url(javascript:alert(1))' },
      { boxShadow: {} },
      { borderStyle: 'double' },
      { overflow: 'scroll' },
      { color: 'transparent' },
    ].map((value) => ({ type: 'style', value })),
  ])
    assert.throws(() => applyOperation(doc, { ...op, id: element.id }));
  assert.deepEqual(element.style, {});
});

test('illustrated button cards apply in one click with focus, selected state and Undo; advanced stays collapsed initially', async (t) => {
  const { w, root, editor, document } = setup(t);
  const element = document.children[0].children[2];
  editor.select(element.id);
  let inspector = root.querySelector('.inspector');
  assert.equal(inspector.querySelectorAll('[data-style-preset]').length, 6);
  assert.equal(inspector.querySelector('details').open, false);
  assert.equal(control(inspector, 'Link destination').closest('details'), null);
  assert.ok(control(inspector, 'Border width').closest('details'));
  let pill = inspector.querySelector('[data-style-preset=pill]');
  assert.equal(pill.querySelector('svg').getAttribute('aria-hidden'), 'true');
  pill.focus();
  pill.click();
  inspector = root.querySelector('.inspector');
  pill = inspector.querySelector('[data-style-preset=pill]');
  assert.equal(pill.getAttribute('aria-pressed'), 'true');
  assert.equal(root.activeElement, pill);
  assert.equal(findNode(editor.getDocument(), element.id).style.borderRadius, 200);
  assert.deepEqual(findNode(editor.getDocument(), element.id).props, element.props);
  pill.click();
  root.querySelector('[aria-label=Undo]').click();
  assert.deepEqual(editor.getDocument(), document);
  root.querySelector('[data-breakpoint=phone]').click();
  root.querySelector('[data-style-preset=outline]').click();
  const changed = findNode(editor.getDocument(), element.id);
  assert.deepEqual(changed.style, {});
  assert.equal(changed.responsive.phone.backgroundColor, 'transparent');
  assert.ok(root.querySelector('.style-preset-current').textContent.includes('Phone'));
  await tick();
});

test('custom shape controls work on an unstyled image and column presets retain hidden visibility', (t) => {
  const document = createDocument();
  const image = node('image', { assetId: 'portrait', alt: 'Portrait' });
  const columns = node('columns');
  columns.style = { display: 'none', width: 75 };
  columns.responsive.phone = { gridColumns: 2 };
  document.children.push(image, columns);
  const { w, root, editor } = setup(t, document);
  editor.select(image.id);
  root.querySelector('[data-advanced-styling]').open = true;
  let field = control(root, 'Border width');
  field.value = '2';
  field.dispatchEvent(new w.Event('change'));
  field = control(root, 'Corner radius');
  field.value = '16';
  field.dispatchEvent(new w.Event('change'));
  const style = findNode(editor.getDocument(), image.id).style;
  assert.equal(style.borderStyle, 'solid');
  assert.equal(style.borderColor, 'border');
  assert.equal(style.borderWidth, 2);
  assert.equal(style.borderRadius, 16);
  assert.equal(style.overflow, 'hidden');
  editor.select(columns.id);
  root.querySelector('[data-style-preset=three]').click();
  const updated = findNode(editor.getDocument(), columns.id);
  assert.equal(updated.style.display, 'none');
  assert.equal(updated.style.width, 75);
  assert.equal(updated.responsive.phone.gridColumns, 2);
  assert.equal(matchingStylePreset(updated, document.theme), 'three');
});

test('Advanced styling persists through edits, custom state is truthful and disclosure remains keyboard focusable', async (t) => {
  const { w, root, editor, document } = setup(t);
  const element = document.children[0].children[2];
  editor.select(element.id);
  root.querySelector('[data-style-preset=rounded]').click();
  const advanced = root.querySelector('[data-advanced-styling]');
  advanced.open = true;
  const border = control(advanced, 'Border width');
  border.focus();
  border.value = '3';
  border.dispatchEvent(new w.Event('change'));
  assert.ok(root.querySelector('[data-advanced-styling]').open);
  assert.ok(root.querySelector('.style-preset-current').textContent.includes('Custom style'));
  assert.equal(root.querySelector('[data-style-preset][aria-pressed=true]'), null);
  assert.equal(root.activeElement.value, '3');
  const summary = root.querySelector('[data-advanced-styling]>summary');
  summary.focus();
  root.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
  assert.equal(root.activeElement.tagName, 'SUMMARY');
  assert.ok(root.querySelector('[data-advanced-styling]').open);
  editor.select(document.children[0].children[0].id);
  assert.equal(root.querySelector('[data-advanced-styling]').open, false);
  const divider = node('divider');
  // Rendering the inspector directly exercises a selection with no basic fields.
  editor.destroy();
  const next = mountEditor(root.host, {
    document: { ...document, children: [divider] },
    adapter: {},
  });
  next.select(divider.id);
  [...root.host.shadowRoot.querySelectorAll('button')]
    .find((n) => n.textContent === 'Edit properties')
    .click();
  assert.equal(root.host.shadowRoot.activeElement.tagName, 'SUMMARY');
  next.destroy();
  await tick();
});

test('all preset families expose named keyboard buttons and valid ARIA without interactive thumbnail controls', async (t) => {
  const { w, root, editor, document } = setup(t);
  const extra = ['container', 'columns', 'image'].map((type) => node(type));
  // Use a second editor document containing all families to exercise actual mounted controls.
  editor.destroy();
  document.children.push(...extra);
  const next = mountEditor(root.host, { document, adapter: {} });
  t.after(() => next.destroy());
  w.document.documentElement.lang = 'en';
  w.eval(axe.source);
  for (const element of [document.children[0], ...document.children[0].children, ...extra]) {
    next.select(element.id);
    const inspector = root.host.shadowRoot.querySelector('.inspector');
    assert.equal(
      inspector.querySelectorAll('[data-style-preset]').length,
      stylePresets(element.type, document.theme).length,
    );
    for (const choice of inspector.querySelectorAll('[data-style-preset]')) {
      assert.ok(choice.getAttribute('aria-label').startsWith('Apply '));
      assert.equal(choice.querySelectorAll('button,input,select,a').length, 0);
    }
  }
  const result = await w.axe.run(w.document, {
    iframes: false,
    runOnly: {
      type: 'rule',
      values: [
        'button-name',
        'label',
        'aria-allowed-attr',
        'aria-valid-attr-value',
        'aria-required-attr',
        'select-name',
        'frame-title',
      ],
    },
  });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations.map((v) => v.id)));
});
