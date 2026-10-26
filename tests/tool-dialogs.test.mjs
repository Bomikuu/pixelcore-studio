import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import axe from 'axe-core';
import { mountEditor } from '../packages/editor/src/index.js';
import { createDocument, node } from '../packages/core/src/index.js';
import { renderMediaPanel } from '../packages/editor/src/workspace/media-panel.js';
const tick = () => new Promise((r) => setImmediate(r));
const button = (root, label) =>
  [...root.querySelectorAll('button')].find((n) => n.textContent === label);
function control(root, label) {
  const l = [...root.querySelectorAll('label')].find((n) => n.textContent === label);
  assert.ok(l, `Missing ${label}`);
  return root.querySelector(`[id="${l.htmlFor}"]`);
}
function change(w, root, label, value) {
  const input = control(root, label);
  input.value = value;
  input.dispatchEvent(new w.Event('change'));
}
function setup(t, options = {}) {
  const w = new Window({
      url: 'http://localhost:4173',
      settings: {
        enableJavaScriptEvaluation: true,
        suppressInsecureJavaScriptEnvironmentWarning: true,
      },
    }),
    host = w.document.createElement('div');
  w.document.body.append(host);
  const document = options.document || createDocument();
  const editor = mountEditor(host, {
    ...options,
    document,
    adapter: { saveDraft: async (_d, v) => ({ version: v + 1 }), ...options.adapter },
    saveDelay: 60000,
  });
  t.after(() => {
    editor.destroy();
    return w.happyDOM.abort();
  });
  return { w, host, root: host.shadowRoot, document, editor };
}
const assets = {
  photo: { url: '/photo.webp', alt: 'Garden', type: 'image', width: 1400, height: 900 },
  video: { url: '/clip.mp4', alt: 'Ceremony', type: 'video' },
};
function file(w, root) {
  const picker = root.querySelector('input[type=file]');
  assert.ok(picker);
  Object.defineProperty(picker, 'files', {
    value: [new w.File(['image'], 'sample.png', { type: 'image/png' })],
  });
  picker.dispatchEvent(new w.Event('change'));
}

test('management tools open a spacious modal without replacing Pages/Layers or element properties', async (t) => {
  const { root, editor, document } = setup(t, { adapter: { listGlobalSections: async () => [] } });
  editor.select(document.children[0].children[0].id);
  const rail = root.querySelector('.rail');
  for (const key of ['brand', 'media', 'globals', 'data']) {
    root.querySelector(`[data-tool=${key}]`).click();
    assert.equal(root.querySelectorAll('.tool-dialog').length, 1);
    assert.equal(root.querySelector('.tool-dialog-body').dataset.workspaceTool, key);
    assert.ok(rail.querySelector('[data-outline]'));
    assert.ok(!rail.querySelector('.palette-grid,.media-grid'));
    assert.equal(root.querySelector('.inspector').querySelectorAll('label').length > 0, true);
  }
  const dialog = root.querySelector('.tool-dialog');
  assert.ok(dialog.getAttribute('aria-describedby'));
  assert.equal(root.querySelectorAll('.tool-dialog-tabs button').length, 4);
  root.querySelector('[aria-label="Close workspace tools"]').click();
  assert.ok(!root.querySelector('.tool-dialog'));
});

test('branding modal updates global fonts, schemes, preview, focus and remembered import text', (t) => {
  const { w, root, editor } = setup(t);
  root.querySelector('[data-tool=brand]').focus();
  root.querySelector('[data-tool=brand]').click();
  let dialog = root.querySelector('.tool-dialog');
  const primary = control(dialog, 'Primary font (headings)');
  primary.focus();
  change(w, dialog, 'Primary font (headings)', 'Cormorant Garamond');
  assert.equal(editor.getDocument().theme.headingFont, 'Cormorant Garamond');
  assert.ok(root.activeElement === control(dialog, 'Primary font (headings)'));
  assert.match(
    dialog.querySelector('[title="Branding preview"]').getAttribute('srcdoc'),
    /Cormorant Garamond/,
  );
  const input = control(dialog, 'Brand kit JSON');
  input.value = '{"version":1}';
  input.dispatchEvent(new w.Event('input'));
  change(w, dialog, 'Base font size', '18');
  assert.equal(control(dialog, 'Brand kit JSON').value, '{"version":1}');
  const scheme = dialog.querySelector('.palette-grid button');
  const name = scheme.getAttribute('aria-label');
  scheme.click();
  assert.equal(editor.getDocument().theme.name, name);
  assert.equal(
    dialog.querySelector('.palette-grid button[aria-pressed=true]').getAttribute('aria-label'),
    name,
  );
  assert.equal(
    root.querySelector('.inspector').textContent.includes('Primary font (headings)'),
    false,
  );
  button(dialog, 'Media library').click();
  assert.equal(dialog.querySelector('[data-workspace-tool]').dataset.workspaceTool, 'media');
  button(dialog, 'Theme & branding').click();
  assert.equal(control(dialog, 'Brand kit JSON').value, '{"version":1}');
  root.querySelector('[aria-label="Close workspace tools"]').click();
  assert.ok(root.activeElement === root.querySelector('[data-tool=brand]'));
});

test('media uses thumbnail cards, an add-media card, selection details, filtering and explicit insertion', async (t) => {
  const { w, root, editor } = setup(t, { data: { assets } });
  await w.happyDOM.whenAsyncComplete();
  root.querySelector('[data-tool=media]').click();
  let dialog = root.querySelector('.tool-dialog');
  const cards = dialog.querySelectorAll('.media-grid>.media-card');
  assert.equal(cards.length, 3);
  assert.equal(cards[2].getAttribute('aria-label'), 'Add media');
  assert.equal(cards[2].disabled, true);
  assert.ok(!dialog.querySelector('input[type=file]'));
  change(w, dialog, 'Media type', 'video');
  assert.equal(dialog.querySelectorAll('.media-grid>.media-card:not(.add-media-card)').length, 1);
  dialog.querySelector('[aria-label="Select Ceremony"]').click();
  assert.ok(dialog.querySelector('.media-detail video[controls]'));
  assert.equal(editor.getDocument().children.length, 2);
  button(dialog, 'Add to page').click();
  assert.ok(!root.querySelector('.tool-dialog'));
  assert.equal(editor.getDocument().children.at(-1).type, 'video');
  root.querySelector('[data-tool=media]').click();
  dialog = root.querySelector('.tool-dialog');
  change(w, dialog, 'Search media', 'Garden');
  assert.equal(dialog.querySelectorAll('.media-grid>.media-card:not(.add-media-card)').length, 1);
  assert.ok(dialog.querySelector('[aria-label="Select Garden"]'));
  change(w, dialog, 'Search media', 'does not exist');
  assert.ok(dialog.textContent.includes('No matching media'));
});

test('replacing selected media closes the workspace and focuses its existing canvas element', async (t) => {
  const doc = createDocument();
  const image = node('image', { assetId: 'old', alt: 'Old' });
  doc.children.push(image);
  const { w, root, editor } = setup(t, { document: doc, data: { assets } });
  await w.happyDOM.whenAsyncComplete();
  editor.select(image.id);
  root.querySelector('[data-tool=media]').click();
  root.querySelector('[aria-label="Select Garden"]').click();
  button(root, 'Replace selected media').click();
  assert.ok(!root.querySelector('.tool-dialog'));
  assert.equal(editor.getDocument().children.at(-1).props.assetId, 'photo');
  assert.equal(root.querySelector('iframe').contentDocument.activeElement.dataset.wbId, image.id);
});

test('upload composer stays inside the media workspace and updates cards without inserting a page element', async (t) => {
  let resolve,
    calls = 0;
  const { w, root, editor } = setup(t, {
    data: { assets: {} },
    adapter: {
      uploadMedia: () => {
        calls++;
        return new Promise((r) => (resolve = r));
      },
    },
  });
  root.querySelector('[data-tool=media]').click();
  root.querySelector('[aria-label="Add media"]').click();
  assert.equal(root.querySelectorAll('dialog').length, 1);
  file(w, root);
  change(w, root, 'Image description (alt text)', 'New photo');
  button(root, 'Upload image').click();
  assert.equal(button(root, 'Uploading…').disabled, true);
  button(root, 'Uploading…').click();
  assert.equal(calls, 1);
  resolve({ id: 'new', url: '/new.webp', alt: 'New photo', type: 'image' });
  await tick();
  assert.ok(root.querySelector('[aria-label="Select New photo"]'));
  assert.ok(root.querySelector('.tool-dialog'));
  assert.equal(editor.getDocument().children.length, 2);
  assert.ok(!root.querySelector('input[type=file]'));
});

test('upload state survives switching tools and a completed upload survives closing its workspace', async (t) => {
  let resolve,
    calls = 0;
  const { w, root } = setup(t, {
    data: { assets: {} },
    adapter: {
      uploadMedia: () => {
        calls++;
        return new Promise((r) => (resolve = r));
      },
    },
  });
  root.querySelector('[data-tool=media]').click();
  root.querySelector('[aria-label="Add media"]').click();
  file(w, root);
  button(root, 'Upload image').click();
  button(root.querySelector('.tool-dialog-tabs'), 'Theme & branding').click();
  button(root.querySelector('.tool-dialog-tabs'), 'Media library').click();
  assert.equal(button(root, 'Uploading…').disabled, true);
  assert.equal(calls, 1);
  root.querySelector('[aria-label="Close workspace tools"]').click();
  resolve({ id: 'new', url: '/new.webp', alt: 'Uploaded later', type: 'image' });
  await tick();
  assert.ok(!root.querySelector('.tool-dialog'));
  root.querySelector('[data-tool=media]').click();
  assert.ok(root.querySelector('[aria-label="Select Uploaded later"]'));
});

test('upload failures remain retryable and visible inside the dialog', async (t) => {
  let attempts = 0;
  const { w, root } = setup(t, {
    adapter: {
      uploadMedia: async () => {
        attempts++;
        throw Error('Storage unavailable');
      },
    },
  });
  root.querySelector('[data-tool=media]').click();
  root.querySelector('[aria-label="Add media"]').click();
  file(w, root);
  button(root, 'Upload image').click();
  await tick();
  assert.ok(root.querySelector('.tool-dialog').textContent.includes('Storage unavailable'));
  assert.equal(button(root, 'Upload image').disabled, false);
  assert.ok(root.querySelector('.tool-dialog').textContent.includes('sample.png'));
  button(root, 'Upload image').click();
  await tick();
  assert.equal(attempts, 2);
});

test('media rendering is bounded, Show more works, and Add media remains the last card', (t) => {
  const w = new Window({ url: 'http://localhost' });
  t.after(() => w.happyDOM.abort());
  const panel = w.document.createElement('div');
  w.document.body.append(panel);
  const data = {
    assets: Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [
        'a' + i,
        { url: '/image' + i + '.webp', alt: 'Image ' + i },
      ]),
    ),
  };
  renderMediaPanel({
    d: w.document,
    panel,
    data,
    adapter: {},
    history: { document: createDocument() },
    command: () => {},
  });
  assert.equal(panel.querySelectorAll('.media-grid>.media-card').length, 25);
  button(panel, 'Show more (6)').click();
  assert.equal(panel.querySelectorAll('.media-grid>.media-card').length, 31);
  assert.equal(
    panel.querySelector('.media-grid').lastElementChild.getAttribute('aria-label'),
    'Add media',
  );
});

test('late shared section reads cannot reopen editors after the manager closes', async (t) => {
  let resolve;
  const section = {
    id: 'shared',
    name: 'Banner',
    version: 1,
    draftVersion: 1,
    publishedVersion: 1,
    node: node('section'),
    affectedPages: [],
  };
  const { root } = setup(t, {
    adapter: {
      listGlobalSections: async () => [section],
      readGlobalSection: () => new Promise((r) => (resolve = r)),
      saveGlobalSection: async () => section,
    },
  });
  root.querySelector('[data-tool=globals]').click();
  await tick();
  button(root, 'Edit Banner').click();
  root.querySelector('[aria-label="Close workspace tools"]').click();
  resolve(section);
  await tick();
  assert.ok(!root.querySelector('dialog'));
});

test('workspace dialogs have named controls, form labels and valid ARIA in light and dark modes', async (t) => {
  const { w, root } = setup(t, {
    data: { assets },
    adapter: { uploadMedia: async () => ({ id: 'new', url: '/new.webp' }) },
  });
  w.document.documentElement.lang = 'en';
  w.eval(axe.source);
  for (const key of ['brand', 'media', 'globals', 'data']) {
    root.querySelector(`[data-tool=${key}]`).click();
    if (key === 'media') root.querySelector('[aria-label="Add media"]').click();
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
          'aria-dialog-name',
        ],
      },
    });
    assert.equal(result.violations.length, 0, JSON.stringify(result.violations.map((v) => v.id)));
    root.querySelector('[aria-label="Close workspace tools"]').click();
  }
  root.querySelector('[data-tool-appearance]').click();
  root.querySelector('[data-tool=media]').click();
  assert.equal(root.host.dataset.editorAppearance, 'dark');
});

test('the save shortcut works inside editing tools without invoking browser Save As', async (t) => {
  let saves = 0;
  const { w, root, editor } = setup(t, {
    adapter: {
      saveDraft: async (_d, v) => {
        saves++;
        return { version: v + 1 };
      },
    },
  });
  root.querySelector('[data-tool=brand]').click();
  change(w, root, 'Base font size', '18');
  const event = new w.KeyboardEvent('keydown', {
    key: 's',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  control(root, 'Base font size').dispatchEvent(event);
  await tick();
  assert.equal(event.defaultPrevented, true);
  assert.equal(saves, 1);
  assert.equal(editor.hasUnsavedChanges, false);
  assert.ok(root.querySelector('.tool-dialog'));
});
