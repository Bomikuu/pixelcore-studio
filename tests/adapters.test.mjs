import test from 'node:test';
import assert from 'node:assert/strict';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WebsitePage as VuePage } from '../packages/vue/src/index.js';
import { WebsitePage as ReactClientPage } from '../packages/react/src/index.js';
import { WebsitePage as ReactPage } from '../packages/react/src/server.js';
import { createDocument } from '../packages/core/src/index.js';
import { renderPage } from '../packages/renderer/src/index.js';
test('Vue and React server adapters use canonical HTML with stable identities', async () => {
  const document = createDocument();
  const canonical = renderPage(document, {}).html;
  const vue = await renderToString(createSSRApp({ render: () => h(VuePage, { document }) }));
  const react = renderToStaticMarkup(createElement(ReactPage, { document }));
  assert.ok(vue.includes(canonical));
  assert.ok(react.includes(canonical));
  assert.ok(vue.includes('Make something worth sharing.'));
  assert.ok(!react.includes('editor/src'));
});

test('React client entry renders in SSR and respects an existing host main landmark', () => {
  const document = createDocument();
  const html = renderToStaticMarkup(createElement(ReactClientPage, { document, landmark: false }));
  assert.ok(html.includes('Make something worth sharing.'));
  assert.ok(!html.includes('<main'));
});
