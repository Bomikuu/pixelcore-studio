import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { mountReview } from '../packages/review/src/index.js';
import { createDocument } from '../packages/core/src/index.js';
test('review renders untrusted comments as text and clears the secret fragment', async () => {
  const w = new Window({ url: 'http://localhost/website-review?review=review-id#secret' });
  const host = w.document.createElement('div');
  w.document.body.append(host);
  const doc = createDocument();
  let ready;
  const loaded = new Promise((r) => (ready = r));
  const viewer = mountReview(host, {
    request: async () => ({
      id: 'review-id',
      revision: 1,
      document: doc,
      data: {},
      canComment: true,
      canResolve: false,
      threads: [
        {
          id: 'thread',
          nodeId: doc.children[0].id,
          x: 0.5,
          y: 0.5,
          resolved: false,
          comments: [{ name: 'Guest', body: '<script>unsafe()</script>' }],
        },
      ],
    }),
    onReady: ready,
  });
  await loaded;
  assert.equal(w.location.hash, '');
  assert.ok(host.shadowRoot.textContent.includes('<script>unsafe()</script>'));
  assert.equal(host.shadowRoot.querySelectorAll('script').length, 0);
  assert.ok(
    ![...host.shadowRoot.querySelectorAll('button')].some((b) => b.textContent === 'Resolve'),
  );
  viewer.destroy();
});
