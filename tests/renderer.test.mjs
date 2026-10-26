import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, node } from '../packages/core/src/index.js';
import { renderPage, templates, applyTemplate } from '../packages/renderer/src/index.js';
test('canonical HTML escapes content and unsafe links', () => {
  const d = createDocument();
  d.children[0].children[0].props.text = '<script>alert(1)</script>';
  d.children[0].children[2].props.href = 'javascript:alert(1)';
  const r = renderPage(d, {});
  assert.ok(r.html.includes('&lt;script&gt;'));
  assert.ok(!r.html.includes('href="javascript:'));
  assert.ok(!r.html.includes('contenteditable'));
  assert.ok(!r.html.includes('editor/src'));
});
test('live values resolve from the host without leaking unused data', () => {
  const d = createDocument({ mode: 'live' });
  d.children[0].children[0].props.text = { source: 'event', path: 'title' };
  const out = renderPage(d, { event: { title: 'Product launch', secret: 'private-value' } });
  assert.match(out.html, /Product launch/);
  assert.ok(!out.html.includes('private-value'));
});
test('presets preserve connections and use distinct identities', () => {
  assert.ok(templates.length >= 4);
  const a = applyTemplate('storefront');
  const b = applyTemplate('storefront');
  assert.notEqual(a.id, b.id);
  assert.match(
    renderPage(
      a,
      { products: [{ name: 'Real tee', base_price: '500', slug: 'tee' }] },
      { baseUrl: '/site/shop' },
    ).html,
    /Real tee/,
  );
});
test('review HTML contains stable element identities and inert actions', () => {
  const d = createDocument();
  const r = renderPage(d, {}, { mode: 'review' });
  assert.ok(r.html.includes(d.children[0].id));
  assert.ok(!r.html.includes('href="#details"'));
  assert.equal(r.head.robots, 'noindex,nofollow');
});

test('theme size and scale change the responsive heading sizes', () => {
  const document = createDocument();
  document.theme.baseSize = 20;
  document.theme.scale = 1.5;
  const html = renderPage(document).html;
  assert.ok(html.includes('--wb-base-size:20px'));
  assert.ok(html.includes('--wb-h1-min:101.25px'));
  assert.ok(html.includes('--wb-h3:45px'));
});
