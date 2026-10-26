import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { mountEditor, createSaveState } from '../packages/editor/src/index.js';
import { createDocument, node } from '../packages/core/src/index.js';
const setup = (options = {}) => {
  const w = new Window({ url: 'http://localhost:4173' });
  const host = w.document.createElement('div');
  w.document.body.append(host);
  return {
    w,
    host,
    editor: mountEditor(host, {
      document: createDocument(),
      adapter: { saveDraft: async (_d, v) => ({ version: v + 1 }) },
      ...options,
    }),
  };
};
test('editor mounts canvas and inspectors, edits, undoes and disposes', () => {
  const { host, editor } = setup();
  assert.ok(host.shadowRoot.querySelector('iframe'));
  const doc = editor.getDocument();
  const id = doc.children[0].children[0].id;
  editor.command({ type: 'text', id, value: 'Changed inline' });
  assert.equal(editor.getDocument().children[0].children[0].props.text, 'Changed inline');
  editor.undo();
  assert.notEqual(editor.getDocument().children[0].children[0].props.text, 'Changed inline');
  editor.destroy();
  assert.equal(host.shadowRoot.children.length, 0);
});
test('inline input is immediate; composition commits only on completion', async () => {
  const { host, editor, w } = setup();
  await w.happyDOM.whenAsyncComplete();
  const frame = host.shadowRoot.querySelector('iframe');
  const fd = frame.contentDocument;
  const target = fd.querySelector('[data-wb-field=text]');
  assert.ok(target);
  target.dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true }));
  target.textContent = 'Real-time text';
  target.dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.equal(editor.getDocument().children[0].children[0].props.text, 'Real-time text');
  target.dispatchEvent(new w.Event('compositionstart', { bubbles: true }));
  target.textContent = 'Unfinished';
  target.dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.equal(
    editor.getDocument().children[0].children[0].props.text,
    'Make something worth sharing.',
  );
  target.dispatchEvent(new w.Event('compositionend', { bubbles: true }));
  target.dispatchEvent(new w.Event('blur'));
  assert.equal(editor.getDocument().children[0].children[0].props.text, 'Unfinished');
  editor.destroy();
});
test('save serialization retains edits made during a request', async () => {
  let release;
  const seen = [];
  const s = createSaveState(
    {
      saveDraft: async (d, v) => {
        seen.push([d.title, v]);
        if (seen.length === 1) await new Promise((r) => (release = r));
        return { version: v + 1 };
      },
    },
    { delay: 99999 },
  );
  s.request({ title: 'First' });
  const p = s.flush();
  s.request({ title: 'Second' });
  release();
  await p;
  assert.deepEqual(seen, [
    ['First', 0],
    ['Second', 1],
  ]);
  assert.equal(s.dirty, false);
  s.destroy();
});
test('conflicts retain unsaved changes until explicit retry', async () => {
  const e = Object.assign(new Error('Newer version'), { code: 'CONFLICT' });
  let fail = true;
  const s = createSaveState(
    {
      saveDraft: async () => {
        if (fail) throw e;
        return { version: 2 };
      },
    },
    { delay: 99999 },
  );
  s.request({ title: 'Keep me' });
  await s.flush();
  assert.equal(s.dirty, true);
  assert.equal(s.error.code, 'CONFLICT');
  fail = false;
  await s.flush();
  assert.equal(s.dirty, false);
  s.destroy();
});
test('connected text is protected and controls have labels', () => {
  const d = createDocument();
  d.children[0].children[0].props.text = { source: 'event', path: 'title' };
  const { host, editor } = setup({ document: d, data: { event: { title: 'Launch' } } });
  editor.select(d.children[0].children[0].id);
  assert.match(host.shadowRoot.textContent, /Connected to event.title/);
  for (const input of host.shadowRoot.querySelectorAll('input,select,textarea'))
    assert.ok(host.shadowRoot.querySelector(`label[for="${input.id}"]`));
  editor.destroy();
});

test('Move into offers non-drag reparenting without self or descendants', () => {
  const document = createDocument();
  const destination = node('section', { name: 'Second section' });
  document.children.push(destination);
  const { host, editor, w } = setup({ document });
  const heading = document.children[0].children[0];
  editor.select(heading.id);
  const label = [...host.shadowRoot.querySelectorAll('label')].find(
    (n) => n.textContent === 'Move into',
  );
  const control = host.shadowRoot.getElementById(label.htmlFor);
  assert.ok(![...control.options].some((o) => o.value === heading.id));
  control.value = destination.id;
  control.dispatchEvent(new w.Event('change'));
  assert.equal(editor.getDocument().children.at(-1).children[0].id, heading.id);
  editor.undo();
  assert.equal(editor.getDocument().children[0].children[0].id, heading.id);
  editor.destroy();
});
