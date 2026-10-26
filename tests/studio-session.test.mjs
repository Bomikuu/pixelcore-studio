import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createJsonClient } from '../packages/core/src/http.js';
test('Studio transport uses its own CSRF cookie and preserves host defaults', async () => {
  const w = new Window({ url: 'http://localhost:4173/' });
  const old = globalThis.document;
  globalThis.document = w.document;
  w.document.cookie = 'csrftoken=host-token';
  w.document.cookie = 'studio_csrftoken=studio-token';
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push(options);
    return { ok: true, json: async () => ({}) };
  };
  try {
    await createJsonClient({ csrfCookieName: 'studio_csrftoken', fetch: fetcher }).send('sites/', {
      method: 'POST',
      body: {},
    });
    await createJsonClient({ fetch: fetcher }).send('sites/', { method: 'POST', body: {} });
    assert.equal(calls[0].headers['X-CSRFToken'], 'studio-token');
    assert.equal(calls[1].headers['X-CSRFToken'], 'host-token');
  } finally {
    globalThis.document = old;
    await w.happyDOM.abort();
  }
});
