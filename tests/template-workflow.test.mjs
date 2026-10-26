import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import axe from 'axe-core';
import {
  createDocument,
  node,
  createHistory,
  templateBranding,
  liveContentNodes,
  prepareContentMode,
  emptyMediaSlots,
  publicationFindings,
} from '../packages/core/src/index.js';
import { applyTemplate } from '../packages/renderer/src/index.js';
import { openContext } from '../packages/editor/src/workspace/context.js';
import { openLibrary } from '../packages/editor/src/library/dialog.js';
import { openDesignPreview } from '../packages/editor/src/library/preview.js';
import { openPublication } from '../packages/editor/src/workspace/publication.js';
import { mountEditor } from '../packages/editor/src/index.js';

const click = (root, label) =>
  [...root.querySelectorAll('button')].find((n) => n.textContent === label);
const tick = () => new Promise((resolve) => setImmediate(resolve));
function dom(t) {
  const w = new Window({
    url: 'http://localhost:4173',
    settings: {
      disableCSSFileLoading: true,
      disableIframePageLoading: true,
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
  });
  t.after(() => w.happyDOM.abort());
  w.document.documentElement.lang = 'en';
  const host = w.document.createElement('div');
  w.document.body.append(host);
  return { w, host, root: host.attachShadow({ mode: 'open' }) };
}
function change(w, control, value) {
  control.value = value;
  control.dispatchEvent(new w.Event('change'));
}
function control(root, label) {
  const text = [...root.querySelectorAll('label')].find((n) => n.textContent === label);
  return text && root.querySelector(`[id="${text.htmlFor}"]`);
}
const source = {
  identity: { name: 'Sample business', description: 'Approved public copy' },
  assets: { hero: { url: '/sample.jpg', alt: 'Sample scene' } },
};

test('setup keep branding preserves all theme settings and explicit template/import choices use the chosen source', (t) => {
  const { w, root } = dom(t),
    document = createDocument();
  document.theme.colors.primary = '#a10052';
  document.theme.headingFont = 'Cormorant Garamond';
  document.theme.baseSize = 19;
  const kit = {
    version: 1,
    colors: { primary: '#024881' },
    headingFont: 'Manrope',
    bodyFont: 'Georgia',
  };
  for (const choice of ['keep', 'template', 'import']) {
    let result;
    openContext({
      root,
      document,
      data: source,
      workspace: { purpose: 'landing' },
      brandKit: kit,
      onApply: (next) => (result = next),
    });
    click(root, 'Continue').click();
    change(w, control(root, 'Start with'), 'landing-minimal');
    click(root, 'Continue').click();
    change(w, control(root, 'Branding'), choice);
    click(root, 'Open studio').click();
    assert.ok(result);
    assert.equal(
      result.theme.colors.primary,
      choice === 'keep'
        ? '#a10052'
        : choice === 'import'
          ? '#024881'
          : applyTemplate('landing').theme.colors.primary,
    );
    assert.equal(
      result.theme.headingFont,
      choice === 'import' ? 'Manrope' : document.theme.headingFont,
    );
    if (choice === 'keep') assert.deepEqual(result.theme, document.theme);
    assert.equal(document.theme.colors.primary, '#a10052');
  }
});

test('invalid brand import stays in setup with a focused correction; absent kits cannot be chosen', (t) => {
  const { w, root } = dom(t);
  const flow = openContext({
    root,
    document: createDocument(),
    workspace: { purpose: 'landing' },
    onApply: () => assert.fail('Unavailable brand applied'),
  });
  click(root, 'Continue').click();
  click(root, 'Continue').click();
  assert.equal(control(root, 'Branding').querySelector('option[value=import]').disabled, true);
  flow.close();
  openContext({
    root,
    document: createDocument(),
    workspace: { purpose: 'landing' },
    brandKit: { version: 1, colors: { primary: 'bad' } },
    onApply: () => assert.fail('Invalid brand applied'),
  });
  click(root, 'Continue').click();
  click(root, 'Continue').click();
  change(w, control(root, 'Branding'), 'import');
  click(root, 'Open studio').click();
  assert.match(root.querySelector('[role=alert]').textContent, /Invalid brand color/);
  assert.equal(root.activeElement, root.querySelector('[role=alert]'));
});

test('fixed setup disables live templates and cannot relabel an existing connected body as authored', (t) => {
  const { w, root } = dom(t),
    document = applyTemplate('storefront', source);
  let applied = 0;
  openContext({
    root,
    document,
    workspace: { purpose: 'storefront', features: ['products'] },
    onApply: () => applied++,
  });
  change(w, control(root, 'Content'), 'fixed');
  click(root, 'Continue').click();
  assert.equal(
    control(root, 'Start with').querySelector('option[value=storefront-editorial]').disabled,
    true,
  );
  click(root, 'Continue').click();
  click(root, 'Open studio').click();
  assert.equal(applied, 0);
  assert.match(root.querySelector('[role=alert]').textContent, /live sections/);
  click(root, 'Back').click();
  click(root, 'Back').click();
  change(w, control(root, 'Content'), 'live');
  click(root, 'Continue').click();
  click(root, 'Continue').click();
  click(root, 'Open studio').click();
  assert.equal(applied, 1);
});

test('a connection enables live mode in one undoable edit, and rejecting fixed leaves history intact', () => {
  const document = createDocument(),
    history = createHistory(document, () => {}, prepareContentMode);
  history.apply({
    type: 'insert',
    id: document.id,
    node: node('products', { source: 'products' }),
  });
  assert.equal(history.document.mode, 'live');
  const connected = structuredClone(history.document);
  assert.throws(
    () => history.apply({ type: 'document', value: { mode: 'fixed' } }),
    /Remove or detach/,
  );
  assert.deepEqual(history.document, connected);
  history.undo();
  assert.deepEqual(history.document, document);
  history.redo();
  assert.deepEqual(history.document, connected);
});

test('mode checks exempt shared frames, inspect actual linked content and never snapshot source records', () => {
  const document = createDocument();
  document.children.unshift(node('header', { source: 'identity' }));
  document.children.push(node('footer', { source: 'identity' }));
  assert.equal(liveContentNodes(document).length, 0);
  const connected = node('heading', { text: { source: 'identity', path: 'name' }, level: 1 });
  const link = node('global-section', { sectionId: 'shared' }, [
    node('section', { name: 'Fallback' }),
  ]);
  document.children.push(link);
  const data = {
    globalSections: { shared: { node: node('section', {}, [connected]) } },
    privateUnused: 'must-not-copy',
  };
  assert.ok(liveContentNodes(document, data).length);
  assert.ok(
    publicationFindings(document, data).some((f) => f.kind === 'mode' && f.level === 'blocker'),
  );
  const next = prepareContentMode(document, {}, data);
  assert.equal(next.mode, 'live');
  assert.doesNotMatch(JSON.stringify(next), /must-not-copy/);
});

test('mounted editor keeps mode control truthful and restores authored mode together with Undo', (t) => {
  const { host, root, w } = dom(t),
    document = createDocument();
  const editor = mountEditor(host, { document, adapter: {} });
  t.after(() => editor.destroy());
  editor.command({
    type: 'insert',
    id: document.id,
    node: node('products', { source: 'products' }),
  });
  editor.select(document.id);
  const mode = control(root.querySelector('.inspector'), 'Content mode');
  assert.equal(mode.value, 'live');
  assert.equal(mode.querySelector('[value=fixed]').disabled, true);
  change(w, mode, 'fixed');
  assert.equal(mode.value, 'live');
  assert.equal(editor.getDocument().mode, 'live');
  editor.undo();
  assert.equal(editor.getDocument().mode, 'fixed');
});

test('template chooser previews and applies the same chosen palette while retaining global fonts', (t) => {
  const { root, w } = dom(t),
    document = createDocument();
  document.theme.colors.primary = '#a10052';
  let chosen;
  openLibrary({
    root,
    kind: 'templates',
    document,
    data: source,
    capabilities: [],
    onChoose: (next) => (chosen = next),
  });
  root.querySelector('[aria-label="Preview Landing minimal"]').click();
  assert.match(root.querySelector('.detail-preview').srcdoc, /--wb-primary:#a10052/);
  change(w, control(root, 'Template branding'), 'template');
  assert.match(root.querySelector('.detail-preview').srcdoc, /--wb-primary:#125b50/);
  click(root, 'Apply to this page').click();
  assert.equal(chosen.theme.colors.primary, '#125b50');
  assert.equal(chosen.theme.headingFont, document.theme.headingFont);
  assert.deepEqual(templateBranding(applyTemplate('landing'), document).theme, document.theme);
});

test('full preview uses real device widths, supports focus and native page scrolling, and keeps RSVP inert', (t) => {
  const { root, w } = dom(t);
  const preview = openDesignPreview({
    root,
    name: 'Wedding',
    document: applyTemplate('event', source),
    data: source,
  });
  const frame = root.querySelector('.template-preview-frame');
  assert.equal(frame.width, '1280');
  assert.equal(frame.getAttribute('tabindex'), '0');
  assert.equal(frame.getAttribute('sandbox'), '');
  assert.doesNotMatch(frame.srcdoc, /pointer-events:none|<form|allow-scripts/);
  assert.match(frame.srcdoc, /<footer /);
  assert.match(frame.srcdoc, /Sample invitation/);
  frame.focus();
  assert.equal(root.activeElement, frame);
  root.querySelector('.template-preview-scrollport').focus();
  assert.equal(root.activeElement.getAttribute('aria-label'), 'Preview canvas');
  click(root, 'Tablet').click();
  assert.equal(frame.width, '768');
  click(root, 'Phone').click();
  assert.equal(frame.width, '390');
  assert.equal(click(root, 'Phone').getAttribute('aria-pressed'), 'true');
  change(w, control(root, 'Zoom'), 'actual');
  assert.equal(frame.style.transform, 'scale(1)');
  click(root, 'Desktop').click();
  assert.equal(frame.width, '1280');
  assert.equal(root.querySelector('.template-preview-frame'), frame);
  preview.element.dispatchEvent(new w.Event('cancel', { cancelable: true }));
  assert.equal(root.querySelector('.template-preview-dialog'), null);
});

test('preview close restores its trigger and closing the library disposes the preview and resize observer', (t) => {
  const { root, w } = dom(t);
  let disconnected = 0;
  w.ResizeObserver = class {
    observe() {}
    disconnect() {
      disconnected++;
    }
  };
  const library = openLibrary({
    root,
    kind: 'templates',
    document: createDocument(),
    data: source,
    onChoose: () => {},
  });
  root.querySelector('[aria-label="Preview Landing minimal"]').click();
  let trigger = click(root, 'Open full-page preview');
  trigger.focus();
  trigger.click();
  click(root, 'Close preview').click();
  assert.equal(root.activeElement, trigger);
  assert.equal(disconnected, 1);
  trigger.click();
  const frame = root.querySelector('.template-preview-frame');
  library.close();
  assert.equal(root.querySelector('dialog'), null);
  assert.equal(disconnected, 2);
  assert.equal(frame.hasAttribute('srcdoc'), false);
  w.dispatchEvent(new w.Event('resize'));
  assert.equal(root.querySelector('iframe'), null);
});

test('empty slots warn before publication, resolve when filled, and exclude row prototypes or shared sources', () => {
  const document = createDocument();
  const image = node('image', { assetId: '', alt: 'Photo' });
  const gallery = node('gallery', { assetIds: [] });
  const video = node('video', { assetId: '' });
  document.children.push(image, gallery, video);
  assert.equal(emptyMediaSlots(document).length, 3);
  assert.equal(
    publicationFindings(document).filter((f) => f.kind === 'media' && f.level === 'warning').length,
    3,
  );
  image.props.assetId = 'hero';
  gallery.props.assetIds = ['hero'];
  video.props.assetId = 'clip';
  const data = {
    assets: { hero: { url: '/photo.jpg' }, clip: { url: '/clip.mp4', type: 'video' } },
  };
  assert.equal(emptyMediaSlots(document, data).length, 0);
  assert.equal(publicationFindings(document, data).filter((f) => f.kind === 'media').length, 0);
  image.props.assetId = { source: 'item', path: 'assetId' };
  assert.equal(emptyMediaSlots(document).length, 0);
  document.children = [
    node('global-section', { sectionId: 'source' }, [
      node('section', {}, [node('image', { assetId: '' })]),
    ]),
  ];
  assert.equal(emptyMediaSlots(document).length, 0);
});

test('publication warning selects the empty image for correction and a legacy fixed/live mismatch blocks publish', async (t) => {
  const { root } = dom(t);
  const document = createDocument();
  const image = node('image', { assetId: '' });
  document.children.push(image);
  let selected,
    published = 0;
  let dialog = openPublication({
    root,
    document,
    data: {},
    adapter: {},
    onSelect: (id) => (selected = id),
    onPublish: () => published++,
  });
  const finding = [...dialog.element.querySelectorAll('button')].find((n) =>
    /Empty image slot/.test(n.textContent),
  );
  finding.click();
  assert.equal(selected, image.id);
  document.children.push(node('products', { source: 'products' }));
  dialog = openPublication({
    root,
    document,
    data: {},
    adapter: {},
    onSelect: () => {},
    onPublish: () => published++,
  });
  click(dialog.element, 'Publish').click();
  await tick();
  assert.equal(published, 0);
  assert.ok(dialog.element.isConnected);
  assert.match(dialog.element.textContent, /content-mode blockers/);
  dialog.close();
});

test('full preview controls and setup feedback have names, labels and valid ARIA', async (t) => {
  const { root, w } = dom(t);
  openDesignPreview({
    root,
    name: 'Landing',
    document: applyTemplate('landing', source),
    data: source,
  });
  w.eval(axe.source);
  const result = await w.axe.run(w.document, {
    iframes: false,
    runOnly: {
      type: 'rule',
      values: [
        'button-name',
        'label',
        'select-name',
        'frame-title',
        'aria-allowed-attr',
        'aria-valid-attr-value',
        'aria-dialog-name',
      ],
    },
  });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations.map((v) => v.id)));
});
