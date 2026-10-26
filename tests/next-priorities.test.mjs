import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import {
  createDocument,
  node,
  validateDocument,
  applyOperation,
  parseTemplateJSON,
  pageHead,
  pageMetadata,
  pageFindings,
  missingAssets,
  remapAsset,
  createJsonClient,
} from '../packages/core/src/index.js';
import {
  renderPage,
  enhancePage,
  sectionPresets,
  elements,
} from '../packages/renderer/src/index.js';
import { renderContentControls } from '../packages/editor/src/inspectors/content.js';
import { renderPageSettings } from '../packages/editor/src/workspace/page-settings.js';
import { renderMediaPanel } from '../packages/editor/src/workspace/media-panel.js';
import { openLibraryManager } from '../packages/editor/src/workspace/library-manager.js';
import { createDjangoAdapter } from '../packages/editor/src/http-adapter.js';
const tick = () => new Promise((resolve) => setImmediate(resolve));
const button = (root, label) =>
  [...root.querySelectorAll('button')].find((e) => e.textContent === label);
function dom(t) {
  const w = new Window({ url: 'http://localhost:4173' });
  t.after(() => w.happyDOM.abort());
  const d = w.document;
  const panel = d.createElement('div');
  d.body.append(panel);
  return { w, d, panel };
}
function change(w, root, label, value) {
  const l = [...root.querySelectorAll('label')].find((e) => e.textContent === label);
  assert.ok(l, `Missing ${label}`);
  const control = root.querySelector(`[id="${l.htmlFor}"]`);
  control.value = value;
  control.dispatchEvent(new w.Event('change'));
}

test('SEO validates imported and edited settings and preserves strict review and host indexing', () => {
  const doc = createDocument();
  doc.seo = {
    title: 'Search title <script>',
    description: 'Description',
    socialTitle: 'Social title',
    socialImage: 'cover',
    canonical: 'https://example.test/page',
    noIndex: false,
  };
  validateDocument(doc);
  assert.equal(
    pageMetadata(doc, { assets: { cover: { url: '/cover.webp' } } }).socialImage,
    '/cover.webp',
  );
  assert.equal(renderPage(doc, {}, { mode: 'review' }).head.robots, 'noindex,nofollow');
  assert.equal(
    pageHead(doc, {}, { noIndex: true }).meta.find((m) => m.name === 'robots').content,
    'noindex,nofollow',
  );
  assert.equal(pageHead(doc).title, 'Search title <script>');
  assert.equal(pageHead(doc).link[0].href, 'https://example.test/page');
  assert.equal(
    applyOperation(doc, { type: 'document', value: { seo: { description: 'Updated' } } }).document
      .seo.description,
    'Updated',
  );
  for (const canonical of [
    'javascript:alert(1)',
    '//evil.test',
    '/relative',
    'https://example.test/\nfoo',
  ])
    assert.throws(() => validateDocument({ ...doc, seo: { canonical } }));
  assert.throws(() => validateDocument({ ...doc, seo: { noIndex: 'false' } }));
  assert.equal(
    parseTemplateJSON(JSON.stringify({ ...doc, title: 'X'.repeat(180) })).name.length,
    100,
  );
  assert.equal(parseTemplateJSON(JSON.stringify(doc)).document.seo.title, doc.seo.title);
});

test('page checks and missing asset replacements cover social, gallery and breakpoint media immutably', () => {
  const doc = createDocument();
  const img = node('image', { assetId: 'old', alt: '' });
  doc.children.push(img, node('gallery', { assetIds: ['old', 'other'] }));
  doc.seo = { socialImage: 'old' };
  img.responsive.phone = { background: { type: 'image', assetId: 'old' } };
  assert.deepEqual(missingAssets(doc, { assets: { other: { url: '/ok.png' } } }), ['old']);
  assert.ok(pageFindings(doc).some((f) => f.id === img.id && f.message.includes('alt text')));
  const next = remapAsset(doc, 'old', 'new');
  assert.equal(next.seo.socialImage, 'new');
  assert.equal(next.children.at(-2).responsive.phone.background.assetId, 'new');
  assert.equal(doc.seo.socialImage, 'old');
  assert.deepEqual(
    missingAssets(next, { assets: { new: { url: '/new.webp' }, other: { url: '/ok.png' } } }),
    [],
  );
});

test('FAQ and tabs are escaped, bounded and readable without enhancement; keyboard tabs clean up', async (t) => {
  const { w, d, panel } = dom(t);
  const doc = createDocument();
  doc.children = [
    node('accordion', { items: [{ title: 'Question <img>', body: 'Answer <script>' }] }),
    node('tabs', {
      items: [
        { title: 'First', body: 'First body' },
        { title: 'Second', body: 'Second body' },
        { title: 'Third', body: 'Third body' },
      ],
    }),
  ];
  const out = renderPage(doc);
  assert.ok(!out.html.includes('<script>'));
  assert.ok(out.html.includes('&lt;script&gt;'));
  panel.innerHTML = out.html;
  assert.equal(panel.querySelectorAll('details summary').length, 1);
  assert.equal(panel.querySelector('.wb-tab-list').hidden, true);
  assert.ok([...panel.querySelectorAll('.wb-tab-panel')].every((p) => !p.hidden));
  const cleanup = enhancePage(panel);
  const tabs = [...panel.querySelectorAll('[role=tab]')];
  assert.equal(tabs.length, 3);
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  tabs[0].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  assert.equal(d.activeElement, tabs[2]);
  assert.equal(tabs[2].getAttribute('aria-selected'), 'true');
  tabs[2].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  assert.equal(d.activeElement, tabs[0]);
  tabs[1].click();
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  assert.equal(panel.querySelectorAll('.wb-tab-panel:not([hidden])').length, 1);
  cleanup();
  assert.ok([...panel.querySelectorAll('.wb-tab-panel')].every((p) => !p.hidden));
  assert.equal(panel.querySelector('.wb-tab-list').hidden, true);
  for (const items of [
    [],
    Array(21).fill({ title: 'a', body: 'b' }),
    [{ title: '', body: 'a' }],
    [{ title: 'a', body: 'b', html: 'evil' }],
  ])
    assert.throws(() => validateDocument({ ...doc, children: [node('tabs', { items })] }));
});

test('image fit/focal/crop and host renditions render safely; videos use only approved video assets', () => {
  const doc = createDocument();
  doc.children = [
    node('image', {
      assetId: 'photo',
      alt: '',
      decorative: 1,
      aspect: '4/3',
      fit: 'contain',
      focalX: 20,
      focalY: 80,
    }),
    node('video', { assetId: 'clip', posterId: 'photo', alt: 'Our story' }),
  ];
  const data = {
    assets: {
      photo: {
        url: '/photo.webp',
        alt: 'Stored alt',
        renditions: [
          { url: '/small.webp', width: 640 },
          { url: 'javascript:evil', width: 10 },
        ],
      },
      clip: { url: '/clip.mp4', type: 'video' },
    },
  };
  const out = renderPage(doc, data);
  assert.match(out.html, /aspect-ratio:4\/3/);
  assert.match(out.html, /object-position:20% 80%/);
  assert.match(out.html, /srcset="\/small.webp 640w"/);
  assert.match(out.html, /alt=""/);
  assert.ok(!out.html.includes('javascript:evil'));
  assert.match(out.html, /<video class="wb-video" controls playsinline preload="none"/);
  assert.match(out.html, /poster="\/photo.webp"/);
  for (const props of [
    { focalX: 101 },
    { aspect: '1;position:fixed' },
    { fit: 'none' },
    { decorative: true },
  ])
    assert.throws(() => validateDocument({ ...doc, children: [node('image', props)] }));
  assert.ok(
    !renderPage({ ...doc, children: [node('video', { assetId: 'photo' })] }, data).html.includes(
      'src="/photo.webp" aria-label',
    ),
  );
});

test('new premade sections and elements validate with and without media', () => {
  for (const preset of sectionPresets.filter(
    (p) =>
      ['Information', 'Contact'].includes(p.category) ||
      ['video-story', 'logo-list'].includes(p.id),
  )) {
    const doc = { ...createDocument(), children: [preset.create({})] };
    validateDocument(doc);
    assert.ok(renderPage(doc).html);
  }
  for (const type of ['accordion', 'tabs', 'video'])
    assert.ok(elements.some((e) => e.type === type));
});

test('native content and SEO controls make validated document operations', (t) => {
  const { w, d, panel } = dom(t);
  const doc = createDocument();
  const n = node('accordion', { items: [{ title: 'Question', body: 'Answer' }] });
  doc.children.push(n);
  let history = { document: doc };
  const ctx = {
    d,
    panel,
    history,
    data: {},
    adapter: {},
    command: (op) => {
      history.document = applyOperation(history.document, op).document;
    },
  };
  renderContentControls(ctx, n);
  change(w, panel, 'Title', 'New question');
  assert.equal(history.document.children.at(-1).props.items[0].title, 'New question');
  panel.replaceChildren();
  renderPageSettings(ctx);
  change(w, panel, 'Search description', 'Search summary');
  assert.equal(history.document.seo.description, 'Search summary');
});

test('media panel retains upload errors, guards duplicate uploads and maps missing files', async (t) => {
  const { w, d, panel } = dom(t);
  let attempts = 0,
    resolveUpload;
  const doc = createDocument();
  doc.children.push(node('image', { assetId: 'missing' }));
  let updated;
  renderMediaPanel({
    d,
    panel,
    history: { document: doc },
    data: { assets: { present: { url: '/image.png', alt: 'Existing image' } } },
    adapter: {
      uploadMedia: () => {
        attempts++;
        return new Promise((r) => (resolveUpload = r));
      },
    },
    command: (op) => {
      updated = op.document;
    },
    onDataChanged: () => {},
  });
  assert.ok(panel.textContent.includes('Missing media: missing'));
  change(w, panel, 'Replace with', 'present');
  button(panel, 'Replace references').click();
  assert.equal(updated.children.at(-1).props.assetId, 'present');
  panel.querySelector('[aria-label="Add media"]').click();
  let upload = button(panel, 'Upload image');
  upload.click();
  assert.equal(attempts, 0);
  upload = button(panel, 'Upload image');
  const picker = panel.querySelector('input[type=file]');
  Object.defineProperty(picker, 'files', {
    value: [new w.File(['image'], 'sample.png', { type: 'image/png' })],
  });
  picker.dispatchEvent(new w.Event('change'));
  upload.click();
  upload.click();
  assert.equal(attempts, 1);
  assert.equal(button(panel, 'Uploading…').disabled, true);
  resolveUpload({ id: 'new', url: '/new.webp' });
  await tick();
  assert.ok(panel.querySelector('[aria-label="Select Image"]'));
});

test('saved design manager restores versions and deletes with expected version', async (t) => {
  const { d, panel } = dom(t);
  const calls = [];
  const item = {
    id: 'a',
    name: 'Layout',
    document: createDocument(),
    version: 3,
    archived: false,
    tags: ['landing'],
    revisions: [
      { number: 3, name: 'Layout' },
      { number: 1, name: 'Original' },
    ],
  };
  const adapter = {
    listTemplates: async () => [item],
    readDesign: async () => item,
    updateDesign: async (...args) => calls.push(args),
    deleteDesign: async (...args) => calls.push(args),
  };
  openLibraryManager({ root: panel, adapter, document: item.document, download: () => {} });
  await tick();
  button(panel, 'Layout · v3 · landing').click();
  await tick();
  button(panel, 'Restore version').click();
  await tick();
  assert.deepEqual(calls[0], ['templates', 'a', { expectedVersion: 3, restoreVersion: 1 }]);
  button(panel, 'Layout · v3 · landing').click();
  await tick();
  button(panel, 'Delete saved design…').click();
  button(panel, 'Delete permanently').click();
  await tick();
  assert.deepEqual(calls[1], ['templates', 'a', 3]);
});

test('authenticated adapter media upload sends multipart without JSON encoding and versions library mutations', async () => {
  const calls = [];
  const adapter = createDjangoAdapter({
    websiteId: 'site',
    workspace: { mediaUpload: true },
    request: async (path, options) => {
      calls.push([path, options]);
      return { asset: { id: 'image' }, design: { id: 'design' } };
    },
  });
  assert.equal((await adapter.uploadMedia(new File(['image'], 'sample.png'), 'Alt')).id, 'image');
  assert.ok(calls.at(-1)[1].body instanceof FormData);
  assert.equal(calls.at(-1)[1].body.get('alt'), 'Alt');
  await adapter.updateDesign('templates', 'design', { expectedVersion: 2, archived: true });
  assert.equal(calls.at(-1)[1].body.expectedVersion, 2);
  const sent = [];
  const client = createJsonClient({
    fetch: async (path, options) => {
      sent.push(options);
      return { ok: true, json: async () => ({}) };
    },
  });
  const body = new FormData();
  body.append('file', new File(['image'], 'sample.png'));
  await client.send('media/', { method: 'POST', body });
  assert.equal(sent.at(-1).body, body);
  assert.equal(sent.at(-1).headers['Content-Type'], undefined);
});

test('media upload failure is retained with a retry and linked source copies stay protected', async (t) => {
  const { w, d, panel } = dom(t);
  let attempts = 0;
  const doc = createDocument();
  renderMediaPanel({
    d,
    panel,
    history: { document: doc },
    data: {},
    adapter: {
      uploadMedia: async () => {
        attempts++;
        throw new Error('Storage unavailable');
      },
    },
    command: () => {},
  });
  panel.querySelector('[aria-label="Add media"]').click();
  const picker = panel.querySelector('input[type=file]');
  Object.defineProperty(picker, 'files', { value: [new w.File(['image'], 'sample.png')] });
  picker.dispatchEvent(new w.Event('change'));
  button(panel, 'Upload image').click();
  await tick();
  assert.ok(panel.textContent.includes('Storage unavailable'));
  assert.equal(button(panel, 'Upload image').disabled, false);
  button(panel, 'Upload image').click();
  await tick();
  assert.equal(attempts, 2);
  const fallback = node('section', {}, [node('image', { assetId: 'shared' })]);
  doc.children.push(node('global-section', { sectionId: 'source' }, [fallback]));
  assert.deepEqual(missingAssets(doc), []);
  assert.equal(
    remapAsset(doc, 'shared', 'other').children.at(-1).children[0].children[0].props.assetId,
    'shared',
  );
});

test('saved design errors stay visible and stale async reads never reopen closed dialogs', async (t) => {
  const { d, panel } = dom(t);
  let resolve;
  const adapter = {
    listTemplates: async () => [{ id: 'id', name: 'Design', version: 1 }],
    readDesign: async () => new Promise((r) => (resolve = r)),
  };
  const dialog = openLibraryManager({
    root: panel,
    adapter,
    document: createDocument(),
    download: () => {},
  });
  await tick();
  button(panel, 'Design · v1').click();
  dialog.close();
  resolve({ name: 'Too late', version: 1 });
  await tick();
  assert.equal(panel.querySelector('dialog'), null);
  const failing = openLibraryManager({
    root: panel,
    adapter: {
      listTemplates: async () => {
        throw new Error('Library unavailable');
      },
    },
    document: createDocument(),
    download: () => {},
  });
  await tick();
  assert.ok(failing.element.textContent.includes('Library unavailable'));
});

test('Vue and React SSR retain the same new interactive sections and metadata remains host owned', async () => {
  const { createSSRApp, h } = await import('vue');
  const { renderToString: vueRender } = await import('@vue/server-renderer');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { WebsitePage: VuePage } = await import('../packages/vue/src/index.js');
  const { WebsitePage: ReactPage } = await import('../packages/react/src/server.js');
  const doc = createDocument();
  doc.children = [
    node('tabs', {
      items: [
        { title: 'Details', body: 'Read me' },
        { title: 'More', body: 'Second body' },
      ],
    }),
    node('accordion', { items: [{ title: 'Question', body: 'Answer' }] }),
  ];
  const canonical = renderPage(doc).html;
  assert.ok(
    (await vueRender(createSSRApp({ render: () => h(VuePage, { document: doc }) }))).includes(
      canonical,
    ),
  );
  assert.ok(renderToStaticMarkup(createElement(ReactPage, { document: doc })).includes(canonical));
  assert.equal(pageHead(doc).title, doc.title);
});

test('logo galleries retain contain fit rather than cropping approved logos', () => {
  const legacy = createDocument();
  assert.doesNotThrow(() =>
    renderPage(
      { ...legacy, children: [node('image', { assetId: 'legacy' })] },
      { assets: { legacy: { url: '/old.png', renditions: 'legacy-data' } } },
    ),
  );
  const doc = createDocument();
  doc.children = [node('gallery', { assetIds: ['logo'], variant: 'logos' })];
  const html = renderPage(doc, { assets: { logo: { url: '/logo.webp' } } }).html;
  assert.match(html, /class="wb-gallery wb-logos"/);
  assert.match(html, /style="object-fit:contain;/);
});
