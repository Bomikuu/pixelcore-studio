import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { connectPlatform } from '../studio/web/platform-connect.js';
const tick = () => new Promise((r) => setImmediate(r));
test('platform connection validates exact origin, iframe source, state and version before exchanging', async () => {
  const w = new Window({
      url: 'http://localhost:4173/login',
      settings: { disableIframePageLoading: true },
    }),
    root = w.document.body;
  let exchanges = 0,
    connected = 0,
    choose,
    choices;
  const state = 'a'.repeat(43),
    client = {
      send: async (path) => {
        if (path.includes('begin'))
          return { state, frameUrl: 'https://platform.example/studio-connect?state=' + state };
        exchanges++;
        return { authenticated: true };
      },
    };
  const cleanup = await connectPlatform({
    root,
    client,
    platform: { id: 'pixelcore', name: 'PixelCore', origin: 'https://platform.example' },
    onConnected: () => connected++,
    onChoices: (items, select) => {
      choices = items;
      choose = select;
    },
  });
  const frame = root.querySelector('iframe'),
    value = {
      type: 'studio:connect',
      version: 1,
      state,
      status: 'connected',
      code: 'one-use-code',
    };
  const send = (origin, source, data) =>
    w.dispatchEvent(new w.MessageEvent('message', { origin, source, data }));
  send('https://evil.example', frame.contentWindow, value);
  send('https://platform.example', w, value);
  send('https://platform.example', frame.contentWindow, { ...value, state: 'wrong' });
  await tick();
  assert.equal(exchanges, 0);
  send('https://platform.example', frame.contentWindow, {
    ...value,
    status: 'choices',
    businesses: [{ id: 'business', name: 'My business' }],
  });
  assert.equal(choices[0].name, 'My business');
  assert.equal(typeof choose, 'function');
  send('https://platform.example', frame.contentWindow, value);
  await tick();
  assert.equal(exchanges, 1);
  assert.equal(connected, 1);
  assert.equal(root.querySelector('iframe'), null);
  cleanup();
  await w.happyDOM.abort();
});
test('aborting a connection removes its frame and ignores late messages', async () => {
  const w = new Window({
      url: 'http://localhost:4173/',
      settings: { disableIframePageLoading: true },
    }),
    controller = new AbortController();
  let exchanged = false;
  const cleanup = await connectPlatform({
    root: w.document.body,
    client: {
      send: async () => ({ state: 'state', frameUrl: 'https://platform.example/studio-connect' }),
    },
    platform: { id: 'pixelcore', name: 'PixelCore', origin: 'https://platform.example' },
    signal: controller.signal,
    onConnected: () => (exchanged = true),
  });
  controller.abort();
  assert.equal(w.document.querySelector('iframe'), null);
  assert.equal(exchanged, false);
  cleanup();
  await w.happyDOM.abort();
});
