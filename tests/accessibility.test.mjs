import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import axe from 'axe-core';
import { mountEditor } from '../packages/editor/src/index.js';
import { createDocument } from '../packages/core/src/index.js';
test('editor controls expose names labels and valid ARIA', async () => {
  const w = new Window({
    url: 'http://localhost:4173',
    settings: {
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
  });
  const host = w.document.createElement('div');
  w.document.documentElement.lang = 'en';
  w.document.body.append(host);
  const editor = mountEditor(host, {
    document: createDocument(),
    adapter: { saveDraft: async (_d, v) => ({ version: v + 1 }) },
  });
  host.shadowRoot.querySelector('[data-tool=templates]').click();
  await Promise.resolve();
  w.eval(axe.source);
  const result = await w.axe.run(w.document, {
    iframes: false,
    runOnly: {
      type: 'rule',
      values: [
        'button-name',
        'label',
        'aria-allowed-attr',
        'aria-valid-attr-value',
        'aria-required-attr',
        'select-name',
        'frame-title',
      ],
    },
  });
  assert.equal(
    result.violations.length,
    0,
    JSON.stringify(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html) }))),
  );
  editor.destroy();
  await w.happyDOM.close();
});
