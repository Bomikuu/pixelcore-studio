import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { mountEditor } from '../packages/editor/src/index.js';
import { createDocument, node, checkContrast } from '../packages/core/src/index.js';
import { lightTokens, tokens } from '../packages/editor/src/tokens.js';
import { createAppearance, appearanceKey } from '../packages/editor/src/workspace/appearance.js';
import { button, createTooltipProvider } from '../packages/editor/src/components/ui/index.js';
import { revealCanvasElement } from '../packages/editor/src/workspace/focus.js';
const tick = () => new Promise((r) => setImmediate(r));
const getButton = (root, label) =>
  [...root.querySelectorAll('button')].find((n) => n.textContent === label);
const control = (root, label, index = 0) => {
  const l = [...root.querySelectorAll('label')].filter((n) => n.textContent === label)[index];
  assert.ok(l, `Missing ${label}`);
  return root.querySelector(`[id="${l.htmlFor}"]`);
};
function setup(t, options = {}) {
  const w = new Window({ url: 'http://localhost:4173' }),
    host = w.document.createElement('div');
  w.document.body.append(host);
  const document = options.document || createDocument();
  const adapter = { saveDraft: async (_d, v) => ({ version: v + 1 }), ...options.adapter };
  const editor = mountEditor(host, { ...options, document, adapter, saveDelay: 60000 });
  t.after(() => {
    editor.destroy();
    return w.happyDOM.abort();
  });
  return { w, host, root: host.shadowRoot, editor, document, adapter };
}

test('light mode is default, switches all chrome tokens, persists and leaves website data unchanged', async (t) => {
  const { w, host, root, editor, document } = setup(t);
  const before = editor.getDocument();
  assert.equal(host.dataset.editorAppearance, 'light');
  assert.equal(host.style.getPropertyValue('--editor-surface'), lightTokens.surface);
  const toggle = root.querySelector('[data-tool-appearance]');
  assert.equal(toggle.getAttribute('aria-label'), 'Switch to dark mode');
  assert.equal(toggle.querySelectorAll('svg').length, 1);
  toggle.click();
  assert.equal(host.dataset.editorAppearance, 'dark');
  assert.equal(host.style.getPropertyValue('--editor-surface'), tokens.surface);
  assert.equal(w.localStorage.getItem(appearanceKey), 'dark');
  assert.deepEqual(editor.getDocument(), before);
  assert.equal(editor.hasUnsavedChanges, false);
  editor.destroy();
  const next = mountEditor(host, { document, adapter: {} });
  assert.equal(host.dataset.editorAppearance, 'dark');
  next.destroy();
});

test('appearance tolerates blocked storage and restores the host tokens and attributes', (t) => {
  const { host } = setup(t);
  const isolated = host.ownerDocument.createElement('div');
  isolated.style.setProperty('--editor-surface', 'pink');
  isolated.dataset.editorAppearance = 'host';
  const appearance = createAppearance(isolated, {
    storage: {
      getItem() {
        throw Error('blocked');
      },
      setItem() {
        throw Error('blocked');
      },
    },
  });
  assert.equal(appearance.value, 'light');
  appearance.set('dark');
  assert.equal(appearance.value, 'dark');
  assert.throws(() => appearance.set('unknown'));
  appearance.destroy();
  assert.equal(isolated.style.getPropertyValue('--editor-surface'), 'pink');
  assert.equal(isolated.dataset.editorAppearance, 'host');
});

test('both editor palettes meet text, tooltip, focus and control contrast thresholds', () => {
  for (const palette of [lightTokens, tokens]) {
    for (const fg of ['text', 'muted', 'danger', 'warning'])
      for (const bg of ['background', 'surface', 'input', 'selected'])
        assert.equal(
          checkContrast({ foreground: palette[fg], background: palette[bg] }).status,
          'pass',
          `${palette.colorScheme} ${fg}/${bg}`,
        );
    assert.equal(
      checkContrast({ foreground: palette.tooltipText, background: palette.tooltipBackground })
        .status,
      'pass',
    );
    assert.equal(
      checkContrast({ foreground: palette.onPrimary, background: palette.primary }).status,
      'pass',
    );
    assert.equal(
      checkContrast({
        foreground: palette.controlBorder,
        background: palette.input,
        role: 'control',
      }).status,
      'pass',
    );
    assert.equal(
      checkContrast({ foreground: palette.focus, background: palette.surface, role: 'control' })
        .status,
      'pass',
    );
  }
});

test('sidebar and toolbar controls use custom labeled tooltips with Escape and teardown', async (t) => {
  const { w, root, editor } = setup(t);
  const tool = root.querySelector('[data-tool=media]');
  assert.equal(tool.hasAttribute('title'), false);
  assert.equal(root.querySelector('button[title]'), null);
  tool.focus();
  const tip = root.querySelector('[role=tooltip]');
  assert.equal(tip.hidden, false);
  assert.equal(tip.textContent, 'Media library');
  assert.equal(tool.getAttribute('aria-describedby'), tip.id);
  assert.equal(tip.parentNode, root);
  tool.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(tip.hidden, true);
  assert.equal(tool.hasAttribute('aria-describedby'), false);
  tool.focus();
  tool.click();
  assert.equal(tip.hidden, true);
  editor.destroy();
  assert.equal(root.querySelector('[role=tooltip]'), null);
});

test('tooltip hover can reach its content, avoids viewport edges, preserves descriptions and cancels late timers', async (t) => {
  const w = new Window({ url: 'http://localhost' });
  t.after(() => w.happyDOM.abort());
  const host = w.document.createElement('div');
  w.document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const tool = button(w.document, 'Tool', () => {}, {
    tooltip: 'Long help',
    'data-tooltip-placement': 'right',
    'aria-describedby': 'existing-help',
  });
  root.append(tool);
  const provider = createTooltipProvider(root, { delay: 0 });
  tool.getBoundingClientRect = () => ({
    left: 1000,
    right: 1020,
    top: 750,
    bottom: 780,
    width: 20,
    height: 30,
  });
  provider.element.getBoundingClientRect = () => ({ width: 200, height: 70 });
  tool.dispatchEvent(new w.PointerEvent('pointerover', { bubbles: true }));
  await new Promise((r) => w.setTimeout(r, 5));
  const tip = provider.element;
  assert.equal(tip.hidden, false);
  assert.ok(parseFloat(tip.style.left) >= 8);
  assert.ok(parseFloat(tip.style.top) >= 8);
  assert.ok(tool.getAttribute('aria-describedby').startsWith('existing-help '));
  tool.dispatchEvent(new w.PointerEvent('pointerout', { bubbles: true, relatedTarget: tip }));
  tip.dispatchEvent(new w.PointerEvent('pointerover', { bubbles: true, relatedTarget: tool }));
  assert.equal(tip.hidden, false);
  provider.hide();
  assert.equal(tool.getAttribute('aria-describedby'), 'existing-help');
  tool.dispatchEvent(new w.PointerEvent('pointerover', { bubbles: true }));
  provider.destroy();
  await tick();
  assert.equal(root.querySelector('[role=tooltip]'), null);
});

test('layer selection reveals, highlights and focuses the corresponding canvas element', async (t) => {
  const { w, root, editor, document } = setup(t);
  await w.happyDOM.whenAsyncComplete();
  const heading = document.children[0].children[0];
  const frame = root.querySelector('iframe');
  const toggle = root.querySelector(`[aria-label="Toggle Introduction"]`);
  toggle.click();
  assert.equal(root.querySelector(`[data-layer-id="${heading.id}"]`), null);
  editor.select(heading.id);
  const target = frame.contentDocument.querySelector(`[data-wb-id="${heading.id}"]`);
  assert.equal(frame.contentDocument.activeElement, target);
  assert.ok(target.hasAttribute('data-wb-selected'));
  assert.ok(root.querySelector(`[data-layer-id="${heading.id}"]`));
  assert.ok(root.querySelector('.inspector').textContent.includes('Heading level'));
  root.querySelector(`[data-layer-id="${document.children[1].id}"]`).click();
  assert.equal(frame.contentDocument.activeElement.dataset.wbId, document.children[1].id);
});

test('canvas clicks and properties action focus the selected target, including mobile inspector', async (t) => {
  const { w, root, editor, document } = setup(t);
  await w.happyDOM.whenAsyncComplete();
  const frame = root.querySelector('iframe'),
    heading = document.children[0].children[0];
  frame.contentDocument.querySelector(`[data-wb-id="${heading.id}"]`).click();
  assert.equal(frame.contentDocument.activeElement.dataset.wbId, heading.id);
  getButton(root, 'Edit properties').click();
  assert.ok(root.querySelector('.inspector').contains(root.activeElement));
  Object.defineProperty(w, 'innerWidth', { value: 500, configurable: true });
  editor.select(heading.id);
  assert.ok(root.querySelector('.workspace').classList.contains('show-properties'));
  assert.equal(root.activeElement.tagName, 'H2');
});

test('selecting a layer clears incompatible search and invalid selections leave the document intact', async (t) => {
  const { w, root, editor, document } = setup(t);
  await w.happyDOM.whenAsyncComplete();
  const search = control(root, 'Find a layer');
  search.value = 'No matches';
  search.dispatchEvent(new w.Event('input'));
  assert.equal(root.querySelectorAll('.outline-row').length, 0);
  editor.select(document.children[0].children[0].id);
  assert.equal(control(root, 'Find a layer').value, '');
  assert.ok(root.querySelectorAll('.outline-row').length > 0);
  const before = editor.getDocument();
  assert.equal(editor.select('removed-element'), false);
  assert.deepEqual(editor.getDocument(), before);
  assert.ok(root.textContent.includes('no longer available'));
});

test('selection reveal calculates the outer scaled canvas scroll and leaves visible elements alone', () => {
  let top;
  const stage = {
    clientHeight: 500,
    scrollTop: 80,
    getBoundingClientRect: () => ({ top: 100 }),
    scrollTo: (o) => (top = o.top),
  };
  const frame = { getBoundingClientRect: () => ({ top: 200 }) };
  const target = { getBoundingClientRect: () => ({ top: 1000, height: 100 }) };
  revealCanvasElement(target, frame, stage, 0.5);
  assert.equal(top, 455);
  top = undefined;
  target.getBoundingClientRect = () => ({ top: 100, height: 100 });
  revealCanvasElement(target, frame, stage, 0.5);
  assert.equal(top, undefined);
});

test('committing an inspector edit preserves control focus, text selection and panel scroll', async (t) => {
  const { w, root, editor, document } = setup(t);
  await w.happyDOM.whenAsyncComplete();
  editor.select(document.children[0].children[0].id);
  const inspector = root.querySelector('.inspector'),
    stage = root.querySelector('.canvas-stage');
  inspector.scrollTop = 130;
  stage.scrollTop = 350;
  const input = control(inspector, 'Text');
  input.focus();
  input.value = 'A new headline';
  input.setSelectionRange(3, 5);
  input.dispatchEvent(new w.Event('change'));
  const replacement = control(inspector, 'Text');
  assert.notEqual(replacement, input);
  assert.equal(root.activeElement, replacement);
  assert.equal(replacement.selectionStart, 3);
  assert.equal(replacement.selectionEnd, 5);
  assert.equal(inspector.scrollTop, 130);
  assert.equal(stage.scrollTop, 350);
});

test('inline editing keeps focus and IME content when selecting the active element', async (t) => {
  const { w, root, editor, document } = setup(t);
  await w.happyDOM.whenAsyncComplete();
  const fd = root.querySelector('iframe').contentDocument;
  const target = fd.querySelector('[data-wb-field=text]');
  target.dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true }));
  target.textContent = 'Composing';
  target.dispatchEvent(new w.Event('compositionstart', { bubbles: true }));
  target.dispatchEvent(new w.Event('input', { bubbles: true }));
  editor.select(target.dataset.wbId);
  assert.equal(fd.activeElement, target);
  assert.equal(target.contentEditable, 'true');
  assert.equal(editor.select(document.children[1].id), false);
  assert.equal(target.contentEditable, 'true');
  target.dispatchEvent(new w.Event('compositionend', { bubbles: true }));
  target.dispatchEvent(new w.Event('blur'));
  assert.equal(editor.getDocument().children[0].children[0].props.text, 'Composing');
});

test('selection actions expose icons, disable boundary moves and select duplicated content', async (t) => {
  const { w, root, editor, document } = setup(t);
  await w.happyDOM.whenAsyncComplete();
  const heading = document.children[0].children[0];
  editor.select(heading.id);
  assert.equal(getButton(root, 'Move up').disabled, true);
  assert.equal(getButton(root, 'Move down').disabled, false);
  assert.ok(getButton(root, 'Duplicate').querySelector('svg[aria-hidden=true]'));
  getButton(root, 'Duplicate').click();
  const children = editor.getDocument().children[0].children;
  assert.equal(children.length, 4);
  assert.equal(
    root.querySelector('iframe').contentDocument.activeElement.dataset.wbId,
    children[1].id,
  );
  getButton(root, 'Remove').click();
  assert.equal(editor.getDocument().children[0].children.length, 3);
  editor.undo();
  assert.equal(editor.getDocument().children[0].children.length, 4);
});

test('preview tabs, disclosures and safe links operate without editing or submitting guest data', async (t) => {
  const doc = createDocument();
  const faq = node('accordion', { items: [{ title: 'Question', body: 'Answer' }] }),
    tabs = node('tabs', {
      items: [
        { title: 'First', body: 'First body' },
        { title: 'Second', body: 'Second body' },
      ],
    });
  doc.children.push(
    faq,
    tabs,
    node('button', { text: 'Details', href: '#details' }),
    node('button', { text: 'External', href: 'https://example.test' }),
    node('widget', { widgetId: 'pixelcore.event-rsvp' }),
  );
  const { w, root, editor } = setup(t, { document: doc });
  await w.happyDOM.whenAsyncComplete();
  const opens = [];
  w.open = (...args) => opens.push(args);
  const before = editor.getDocument();
  getButton(root, 'Preview').click();
  assert.ok(root.querySelector('.workspace').classList.contains('preview-mode'));
  let fd = root.querySelector('iframe').contentDocument;
  assert.equal(fd.querySelector('[data-wb-selected]'), null);
  assert.equal(fd.querySelector('[contenteditable=true]'), null);
  assert.equal(fd.querySelector('form'), null);
  const tabButtons = [...fd.querySelectorAll('[role=tab]')];
  tabButtons[1].click();
  assert.equal(tabButtons[1].getAttribute('aria-selected'), 'true');
  const summary = fd.querySelector('summary');
  const event = new w.MouseEvent('click', { bubbles: true, cancelable: true });
  summary.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  [...fd.querySelectorAll('a')].find((a) => a.textContent === 'Details').click();
  assert.equal(fd.activeElement.id, 'details');
  [...fd.querySelectorAll('a')].find((a) => a.textContent === 'External').click();
  assert.deepEqual(opens, [['https://example.test', '_blank', 'noopener,noreferrer']]);
  assert.deepEqual(editor.getDocument(), before);
  getButton(root, 'Back to editing').click();
  assert.ok(getButton(root, 'Preview').querySelector('svg'));
  assert.equal(root.querySelector('.workspace').classList.contains('preview-mode'), false);
  assert.equal(editor.hasUnsavedChanges, false);
});

test('editing tabs remain interactive while their widget is selected', async (t) => {
  const doc = createDocument();
  doc.children.push(
    node('tabs', {
      items: [
        { title: 'One', body: 'Body one' },
        { title: 'Two', body: 'Body two' },
      ],
    }),
  );
  const { w, root, editor } = setup(t, { document: doc });
  await w.happyDOM.whenAsyncComplete();
  const fd = root.querySelector('iframe').contentDocument;
  const tab = [...fd.querySelectorAll('[role=tab]')][1];
  tab.click();
  assert.equal(tab.getAttribute('aria-selected'), 'true');
  assert.equal(editor.getDocument().children.at(-1).props.items.length, 2);
  assert.ok(root.querySelector('.inspector').textContent.includes('Add item'));
});

test('unconfigured host actions are explicitly unavailable instead of dead clicks', (t) => {
  const { root } = setup(t, { adapter: { saveDraft: undefined } });
  for (const label of ['Save draft', 'Save now', 'Share', 'Publish', 'History'])
    assert.equal(getButton(root, label).disabled, true, label);
});

test('late library reads are ignored after changing tools, superseding a request or destroying the editor', async (t) => {
  let readTemplates, readSections;
  const { root, editor } = setup(t, {
    adapter: {
      listTemplates: () => new Promise((r) => (readTemplates = r)),
      listSections: () => new Promise((r) => (readSections = r)),
    },
  });
  root.querySelector('[data-tool=templates]').click();
  root.querySelector('[data-tool=media]').click();
  readTemplates([]);
  await tick();
  assert.ok(!root.querySelector('.library-dialog'));
  assert.ok(root.querySelector('.tool-dialog').textContent.includes('Your media'));
  root.querySelector('[aria-label="Close workspace tools"]').click();
  root.querySelector('[data-tool=templates]').click();
  root.querySelector('[data-tool=elements]').click();
  readTemplates([]);
  await tick();
  assert.ok(!root.querySelector('.library-dialog'));
  readSections([]);
  await tick();
  assert.equal(root.querySelectorAll('dialog').length, 1);
  assert.equal(root.querySelector('dialog').getAttribute('aria-label'), 'Add to your page');
  root.querySelector('[aria-label="Close library"]').click();
  root.querySelector('[data-tool=templates]').click();
  editor.destroy();
  readTemplates([]);
  await tick();
  assert.equal(root.children.length, 0);
});

test('saving a reusable section guards duplicate clicks and restores retry after an error', async (t) => {
  let calls = 0,
    reject;
  const { root, editor, document } = setup(t, {
    adapter: {
      saveSection: () => {
        calls++;
        return new Promise((_, r) => (reject = r));
      },
    },
  });
  editor.select(document.children[0].id);
  const save = getButton(root, 'Save section');
  save.click();
  save.click();
  assert.equal(calls, 1);
  assert.equal(save.getAttribute('aria-busy'), 'true');
  reject(new Error('Storage unavailable'));
  await tick();
  assert.equal(save.disabled, false);
  assert.equal(save.hasAttribute('aria-busy'), false);
  assert.ok(root.textContent.includes('Storage unavailable'));
});

test('collection template controls cannot offer invalid deletion, duplication or moving into linked sources', (t) => {
  const doc = createDocument();
  const card = node('container', {}, [node('text', { text: 'A card' })]);
  const repeater = node('repeater', { source: 'products' }, [card]);
  const fallback = node('section', {}, [node('text', { text: 'Shared' })]);
  const link = node('global-section', { sectionId: 'source' }, [fallback]);
  doc.children.push(repeater, link);
  const { root, editor } = setup(t, { document: doc });
  editor.select(card.id);
  assert.equal(getButton(root, 'Duplicate').disabled, true);
  assert.equal(getButton(root, 'Remove').disabled, true);
  assert.equal(control(root, 'Move into').disabled, true);
  editor.select(doc.children[0].children[0].id);
  const options = [...control(root, 'Move into').options];
  assert.ok(!options.some((o) => [link.id, fallback.id, repeater.id].includes(o.value)));
});

test('Enter on structural elements never turns them into editable text and native controls retain activation', async (t) => {
  const doc = createDocument();
  doc.children.push(
    node('tabs', {
      items: [
        { title: 'One', body: 'First' },
        { title: 'Two', body: 'Second' },
      ],
    }),
  );
  const { w, root, editor } = setup(t, { document: doc });
  await w.happyDOM.whenAsyncComplete();
  const fd = root.querySelector('iframe').contentDocument;
  const section = fd.querySelector(`[data-wb-id="${doc.children[0].id}"]`);
  section.dispatchEvent(
    new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
  );
  assert.notEqual(section.contentEditable, 'true');
  const tab = fd.querySelector('[role=tab]');
  const event = new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  tab.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(editor.hasUnsavedChanges, false);
});

test('pointer-driven field changes keep the clicked control alive through its activation', async (t) => {
  const { w, root, editor, document } = setup(t);
  await w.happyDOM.whenAsyncComplete();
  editor.select(document.children[0].children[0].id);
  const text = control(root, 'Text'),
    size = control(root, 'Font size');
  text.focus();
  size.dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true }));
  text.value = 'Changed before clicking';
  text.dispatchEvent(new w.Event('change'));
  assert.equal(size.isConnected, true);
  size.focus();
  size.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.equal(root.activeElement, control(root, 'Font size'));
  assert.equal(control(root, 'Text').value, 'Changed before clicking');
  const nextSize = control(root, 'Font size');
  const duplicate = getButton(root, 'Duplicate');
  duplicate.dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true }));
  nextSize.value = '30';
  nextSize.dispatchEvent(new w.Event('change'));
  assert.equal(duplicate.isConnected, true);
  duplicate.click();
  assert.equal(editor.getDocument().children[0].children.length, 4);
  assert.equal(editor.getDocument().children[0].children[0].style.fontSize, 30);
});

test('Tab-driven field commits restore the destination control after focus moves', async (t) => {
  const { w, root, editor, document } = setup(t);
  await w.happyDOM.whenAsyncComplete();
  editor.select(document.children[0].children[0].id);
  const text = control(root, 'Text'),
    level = control(root, 'Heading level');
  text.focus();
  text.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  text.value = 'Tabbed edit';
  text.dispatchEvent(new w.Event('change'));
  assert.equal(level.isConnected, true);
  level.focus();
  await new Promise((r) => w.setTimeout(r, 5));
  assert.equal(root.activeElement, control(root, 'Heading level'));
  assert.equal(control(root, 'Text').value, 'Tabbed edit');
});
