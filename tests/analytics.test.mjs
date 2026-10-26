import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { validateAnalytics } from '../packages/core/src/analytics.js';
import { enhanceAnalytics } from '../packages/renderer/src/analytics.js';
import { createDocument, templateDocument } from '../packages/core/src/index.js';
const config = { provider: 'google', domain: 'example.com', measurementId: 'G-ABCDEFG123' };
test('exported layouts do not carry the source website analytics identity', () => {
  const document = createDocument();
  document.analytics = config;
  assert.equal(templateDocument(document).analytics, undefined);
  assert.deepEqual(document.analytics, config);
});
test('analytics config is structured and rejects executable or foreign URLs', () => {
  assert.deepEqual(validateAnalytics(), { provider: 'none', domain: '' });
  assert.deepEqual(validateAnalytics(config), config);
  for (const value of [
    { ...config, domain: 'https://example.com' },
    { ...config, measurementId: 'G-X;alert(1)' },
    { ...config, script: 'x' },
    {
      provider: 'plausible',
      domain: 'example.com',
      scriptUrl: 'https://evil.example/js/tracker.js',
    },
  ])
    assert.throws(() => validateAnalytics(value));
});
test('analytics requires explicit public consent and matching domain, deduplicates and disables on cleanup', async () => {
  const w = new Window({
    url: 'https://example.com/hello',
    settings: { disableJavaScriptFileLoading: true },
  });
  const root = w.document.body;
  enhanceAnalytics(root, config);
  assert.equal(w.document.querySelectorAll('script').length, 0);
  enhanceAnalytics(root, config, { consent: true, mode: 'review' });
  assert.equal(w.document.querySelectorAll('script').length, 0);
  const dispose = enhanceAnalytics(root, config, { consent: true }),
    other = enhanceAnalytics(root, config, { consent: true });
  assert.equal(w.document.querySelectorAll('script').length, 1);
  w.document.querySelector('script').dispatchEvent(new w.Event('load'));
  assert.equal(w['ga-disable-G-ABCDEFG123'], false);
  dispose();
  assert.equal(w['ga-disable-G-ABCDEFG123'], false);
  other();
  assert.equal(w['ga-disable-G-ABCDEFG123'], true);
  await w.happyDOM.abort();
});
