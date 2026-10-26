import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDocument,
  validateDocument,
  applyOperation,
  findNode,
  cloneNode,
  schemes,
  checkContrast,
  resolveValue,
  validateBrandKit,
} from '../packages/core/src/index.js';
test('documents reject duplicate identities and invalid nesting', () => {
  const doc = createDocument();
  doc.children.push(structuredClone(doc.children[0]));
  assert.throws(() => validateDocument(doc), /duplicate/i);
});
test('reorder preserves identity and undo restores document', () => {
  const doc = createDocument();
  const a = doc.children[0].id;
  const b = doc.children[1].id;
  const moved = applyOperation(doc, { type: 'move', id: b, parentId: doc.id, beforeId: a });
  assert.equal(moved.document.children[0].id, b);
  assert.deepEqual(applyOperation(moved.document, moved.inverse).document, doc);
  assert.throws(
    () => applyOperation(doc, { type: 'move', id: a, parentId: doc.children[0].children[0].id }),
    /parent|descendant|nest/i,
  );
});
test('duplicate allocates fresh descendant IDs', () => {
  const n = createDocument().children[0];
  const copy = cloneNode(n);
  assert.notEqual(n.id, copy.id);
  assert.notEqual(n.children[0].id, copy.children[0].id);
});
test('connected values cannot silently mutate records', () => {
  assert.equal(
    resolveValue({ source: 'event', path: 'title' }, { event: { title: 'Launch' } }),
    'Launch',
  );
  assert.equal(resolveValue({ source: 'event', path: 'private' }, { event: {} }), undefined);
  const d = createDocument();
  const n = d.children[0].children[0];
  n.props.text = { source: 'event', path: 'title' };
  assert.throws(
    () => applyOperation(d, { type: 'text', id: n.id, value: 'Changed' }),
    /connected/i,
  );
});
test('contrast exact boundaries and indeterminate backgrounds', () => {
  assert.equal(checkContrast({ foreground: '#000000', background: '#ffffff' }).ratio, 21);
  assert.equal(checkContrast({ foreground: '#ffffff', background: '#ffffff' }).ratio, 1);
  assert.equal(
    checkContrast({ foreground: '#000000', background: { type: 'image' } }).status,
    'needs-review',
  );
  assert.equal(
    checkContrast({ foreground: '#777777', background: '#ffffff', fontSize: 23.99 }).status,
    'fail',
  );
  assert.equal(
    checkContrast({ foreground: '#777777', background: '#ffffff', fontSize: 24 }).status,
    'pass',
  );
});
test('presets are complete and brand import is validated', () => {
  assert.equal(schemes.length, 6);
  for (const s of schemes)
    assert.equal(
      checkContrast({ foreground: s.colors.text, background: s.colors.background }).status,
      'pass',
    );
  assert.throws(() => validateBrandKit({ version: 1, colors: { text: 'url(evil)' } }));
});
test('inherited image backgrounds cannot receive a false contrast pass', async () => {
  const { contrastFindings } = await import('../packages/core/src/index.js');
  const d = createDocument();
  d.children[0].style.background = { type: 'image', assetId: 'hero' };
  const findings = contrastFindings(d);
  assert.equal(
    findings.find((f) => f.nodeId === d.children[0].children[0].id).status,
    'needs-review',
  );
});
