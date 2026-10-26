import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createDocument, node } from '../packages/core/src/index.js';
import { createRecoveryStore, openRecovery } from '../packages/editor/src/workspace/recovery.js';
import { openRevisionHistory } from '../packages/editor/src/workspace/revisions.js';

const storage = () => {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};
const dom = () => {
  const w = new Window({ url: 'http://localhost' });
  const host = w.document.createElement('div');
  w.document.body.append(host);
  return { w, root: host.attachShadow({ mode: 'open' }) };
};
const find = (root, text) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent === text);
const settle = async () => {
  await new Promise((resolve) => setImmediate(resolve));
};
const fixture = () => ({
  version: 1,
  scope: 'tenant/user',
  websiteId: 'page',
  savedAt: 1000,
  baseVersion: 2,
  document: createDocument(),
});

test('recovery requires a host scope, isolates users/sites and stores a validated document copy only', () => {
  const memory = storage(),
    document = createDocument();
  const store = createRecoveryStore({
    storage: memory,
    scope: 'tenant/user',
    websiteId: 'page',
    now: () => 1000,
  });
  assert.equal(
    createRecoveryStore({ storage: memory, websiteId: 'page' }).write(document, 2).reason,
    'scope-required',
  );
  assert.equal(memory.values.size, 0);
  assert.equal(store.write(document, 2).ok, true);
  document.title = 'New edit';
  assert.notEqual(store.read().entry.document.title, document.title);
  for (const args of [
    { scope: 'tenant/other', websiteId: 'page' },
    { scope: 'tenant/user', websiteId: 'other' },
  ])
    assert.equal(createRecoveryStore({ storage: memory, ...args }).read().reason, 'missing');
  const original = memory.getItem(store.key);
  assert.equal(
    store.write({ ...document, dataSnapshot: { privateRecord: 'must not persist' } }, 2).reason,
    'invalid-document',
  );
  assert.equal(memory.getItem(store.key), original);
  assert.equal(store.clear().ok, true);
  assert.equal(store.read().reason, 'missing');
});

test('recovery rejects expired, corrupted, oversized and mismatched records without deleting the copy', () => {
  const memory = storage(),
    store = createRecoveryStore({
      storage: memory,
      scope: 'tenant/user',
      websiteId: 'page',
      now: () => 1000,
    });
  const put = (record) =>
    memory.setItem(store.key, typeof record === 'string' ? record : JSON.stringify(record));
  const entry = fixture();
  for (const [value, reason] of [
    [{ ...entry, savedAt: 1000 - 8 * 86400000 }, 'expired'],
    [{ ...entry, savedAt: 1000 - 7 * 86400000 }, 'expired'],
    [{ ...entry, scope: 'other' }, 'scope-mismatch'],
    [{ ...entry, websiteId: 'other' }, 'scope-mismatch'],
    [{ ...entry, version: 2 }, 'corrupt'],
    [{ ...entry, savedAt: 1000000 }, 'corrupt'],
    [{ ...entry, data: {} }, 'corrupt'],
    ['{broken', 'corrupt'],
    ['x'.repeat(550001), 'oversize'],
  ]) {
    put(value);
    assert.equal(store.read().reason, reason);
    assert.equal(memory.values.size, 1);
  }
});

test('recovery quota errors preserve the previous copy and are safe for unavailable storage', () => {
  const memory = storage(),
    args = { storage: memory, scope: 'tenant/user', websiteId: 'page', now: () => 1000 };
  const store = createRecoveryStore(args);
  assert.equal(store.write(createDocument(), 0).ok, true);
  const original = memory.getItem(store.key);
  memory.setItem = () => {
    throw new Error('Quota');
  };
  assert.equal(store.write(createDocument(), 0).reason, 'storage-unavailable');
  assert.equal(memory.getItem(store.key), original);
  const inaccessible = createRecoveryStore({ ...args, storage: {} });
  assert.equal(inaccessible.read().reason, 'storage-unavailable');
  assert.equal(inaccessible.clear().reason, 'storage-unavailable');
});

test('stale recovery permits export and discard, and cannot restore over a newer draft', async () => {
  const { root, w } = dom(),
    entry = fixture();
  let exported = 0,
    restored = 0,
    discarded = 0;
  openRecovery({
    root,
    entry,
    currentVersion: 3,
    onExport: (document) => {
      exported++;
      assert.deepEqual(document, entry.document);
    },
    onRestore: () => restored++,
    onDiscard: () => discarded++,
  });
  assert.equal(find(root, 'Restore draft'), undefined);
  assert.match(root.textContent, /server draft has changed/);
  find(root, 'Export recovery JSON').click();
  await settle();
  assert.equal(exported, 1);
  assert.equal(restored, 0);
  assert.ok(root.querySelector('dialog'));
  find(root, 'Discard recovery').click();
  await settle();
  assert.equal(discarded, 1);
  assert.equal(root.querySelector('dialog'), null);
  w.happyDOM.abort();
});

test('recovery requires an explicit choice and retains failures for retry while guarding duplicate restores', async () => {
  const { root, w } = dom(),
    entry = fixture();
  let attempts = 0,
    release;
  openRecovery({
    root,
    entry,
    currentVersion: 2,
    onRestore: () => {
      attempts++;
      if (attempts === 1) throw new Error('Draft changed. Export your copy.');
      return new Promise((resolve) => {
        release = resolve;
      });
    },
  });
  assert.equal(attempts, 0);
  find(root, 'Restore draft').click();
  await settle();
  assert.match(root.textContent, /Draft changed/);
  assert.ok(root.querySelector('dialog'));
  const restore = find(root, 'Restore draft');
  restore.click();
  restore.click();
  assert.equal(attempts, 2);
  release();
  await settle();
  assert.equal(root.querySelector('dialog'), null);
  w.happyDOM.abort();
});

test('history previews only supplied public data, labels draft/live and confirms before restoration', async () => {
  const { root, w } = dom(),
    document = createDocument();
  const revision = {
    id: 'r1',
    number: 1,
    createdAt: '2026-10-24T00:00:00Z',
    isDraft: true,
    isPublished: true,
  };
  let restored = 0;
  const history = openRevisionHistory({
    root,
    document,
    currentVersion: 2,
    adapter: {
      listRevisions: async () => [revision],
      readRevision: async () => ({ ...revision, document }),
    },
    onRestore: (value) => {
      restored++;
      assert.equal(value.id, 'r1');
    },
  });
  await history.ready;
  const row = root.querySelector('[data-revision="r1"]');
  assert.match(row.textContent, /Draft/);
  assert.match(row.textContent, /Live/);
  row.click();
  await settle();
  const frame = root.querySelector('iframe');
  assert.equal(frame.getAttribute('sandbox'), '');
  assert.match(frame.getAttribute('srcdoc'), /default-src 'none'/);
  assert.match(frame.getAttribute('srcdoc'), /noindex|wb-page/);
  assert.equal(restored, 0);
  find(root, 'Restore as draft').click();
  assert.equal(restored, 0);
  find(root, 'Cancel restoration').click();
  find(root, 'Restore as draft').click();
  find(root, 'Confirm restoration').click();
  await settle();
  assert.equal(restored, 1);
  assert.equal(root.querySelector('dialog'), null);
  w.happyDOM.abort();
});

test('history listing, reading and restoring failures each retain retry paths', async () => {
  const { root, w } = dom(),
    document = createDocument();
  let lists = 0,
    reads = 0,
    restores = 0;
  const history = openRevisionHistory({
    root,
    document,
    currentVersion: 2,
    adapter: {
      listRevisions: async () => {
        if (++lists === 1) throw new Error('History unavailable');
        return [{ id: 'r1', number: 1 }];
      },
      readRevision: async () => {
        if (++reads === 1) throw new Error('Revision unavailable');
        return { document };
      },
    },
    onRestore: async () => {
      if (++restores === 1) throw new Error('Draft version changed');
    },
  });
  await history.ready;
  assert.match(root.textContent, /History unavailable/);
  find(root, 'Retry history').click();
  await settle();
  root.querySelector('[data-revision="r1"]').click();
  await settle();
  assert.match(root.textContent, /Revision unavailable/);
  find(root, 'Retry revision').click();
  await settle();
  find(root, 'Restore as draft').click();
  find(root, 'Confirm restoration').click();
  await settle();
  assert.match(root.textContent, /Draft version changed/);
  assert.ok(root.querySelector('dialog'));
  assert.equal(find(root, 'Compare draft with live').disabled, true);
  find(root, 'Confirm restoration').click();
  await settle();
  assert.equal(restores, 2);
  assert.equal(root.querySelector('dialog'), null);
  w.happyDOM.abort();
});

test('history ignores stale asynchronous reads and completion after dialog closure', async () => {
  const { root, w } = dom(),
    document = createDocument();
  let releaseFirst, releaseSecond;
  const history = openRevisionHistory({
    root,
    document,
    adapter: {
      listRevisions: async () => [
        { id: 'r1', number: 1 },
        { id: 'r2', number: 2 },
      ],
      readRevision: (id) =>
        new Promise((resolve) => {
          if (id === 'r1') releaseFirst = resolve;
          else releaseSecond = resolve;
        }),
    },
  });
  await history.ready;
  root.querySelector('[data-revision="r1"]').click();
  root.querySelector('[data-revision="r2"]').click();
  releaseFirst({ document: { ...document, title: 'Stale title' } });
  await settle();
  assert.equal(root.querySelector('iframe'), null);
  history.close();
  releaseSecond({ document });
  await settle();
  assert.equal(root.querySelector('dialog'), null);
  w.happyDOM.abort();
});

test('history compares current draft and live layouts with structural counts using the same public data', async () => {
  const { root, w } = dom(),
    live = createDocument(),
    document = structuredClone(live);
  live.children[1].children[1].props.text = { source: 'identity', path: 'name' };
  document.children[1].children[1].props.text = { source: 'identity', path: 'name' };
  document.children[0].children.shift();
  document.children[0].children.push(node('text', { text: 'An added element' }));
  document.children[0].children[0].props.text = 'Edited draft text';
  document.theme.bodyFont = 'Arial';
  const original = JSON.stringify({ live, document });
  let restored = 0,
    published = 0;
  const history = openRevisionHistory({
    root,
    document,
    data: { identity: { name: 'Current public business' } },
    adapter: {
      listRevisions: async () => [{ id: 'live', number: 1, isPublished: true }],
      readRevision: async () => ({ document: live }),
      publish: async () => published++,
    },
    onRestore: () => restored++,
  });
  await history.ready;
  find(root, 'Compare draft with live').click();
  await settle();
  assert.match(root.textContent, /1 added · 1 removed · 2 changed elements · Theme changed/);
  assert.match(root.textContent, /Both previews use the same current public data/);
  const frames = [...root.querySelectorAll('iframe')];
  assert.deepEqual(
    frames.map((frame) => frame.title),
    ['Live layout preview', 'Current draft preview'],
  );
  for (const frame of frames) {
    assert.equal(frame.getAttribute('sandbox'), '');
    assert.match(frame.getAttribute('srcdoc'), /Current public business/);
  }
  assert.match(frames[0].getAttribute('srcdoc'), /Make something worth sharing/);
  assert.match(frames[1].getAttribute('srcdoc'), /Edited draft text/);
  assert.equal(JSON.stringify({ live, document }), original);
  assert.equal(published, 0);
  assert.equal(restored, 0);
  root.querySelector('[data-revision="live"]').click();
  await settle();
  find(root, 'Restore as draft').click();
  find(root, 'Confirm restoration').click();
  await settle();
  assert.equal(restored, 1);
  assert.equal(published, 0);
  w.happyDOM.abort();
});

test('history explains unavailable comparison before a first publication', async () => {
  const { root, w } = dom();
  let reads = 0;
  const history = openRevisionHistory({
    root,
    document: createDocument(),
    adapter: {
      listRevisions: async () => [{ id: 'draft', number: 1, isDraft: true }],
      readRevision: async () => {
        reads++;
        return { document: createDocument() };
      },
    },
  });
  await history.ready;
  assert.equal(find(root, 'Compare draft with live').disabled, true);
  assert.match(root.textContent, /Publish this page to compare/);
  find(root, 'Compare draft with live').click();
  await settle();
  assert.equal(reads, 0);
  history.close();
  w.happyDOM.abort();
});

test('history comparison retains load failures for retry and suppresses stale completion after close', async () => {
  const { root, w } = dom(),
    document = createDocument();
  let reads = 0,
    release;
  const history = openRevisionHistory({
    root,
    document,
    adapter: {
      listRevisions: async () => [{ id: 'live', number: 1, isPublished: true }],
      readRevision: async () => {
        reads++;
        if (reads === 1) throw new Error('Live revision unavailable');
        if (reads === 3)
          return new Promise((resolve) => {
            release = resolve;
          });
        return { document };
      },
    },
  });
  await history.ready;
  find(root, 'Compare draft with live').click();
  await settle();
  assert.match(root.textContent, /Live revision unavailable/);
  assert.equal(root.querySelectorAll('iframe').length, 0);
  find(root, 'Retry comparison').click();
  await settle();
  assert.equal(root.querySelectorAll('iframe').length, 2);
  assert.match(root.textContent, /0 added · 0 removed · 0 changed elements · Theme unchanged/);
  find(root, 'Compare draft with live').click();
  await settle();
  history.close();
  release({ document });
  await settle();
  assert.equal(root.querySelector('dialog'), null);
  w.happyDOM.abort();
});
