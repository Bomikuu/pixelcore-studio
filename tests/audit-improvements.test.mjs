import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import {
  createDocument,
  node,
  fontOptions,
  publicationFindings,
  createConsentStore,
  consentKey,
} from '../packages/core/src/index.js';
import { mountReview } from '../packages/review/src/index.js';
import { mountEditor } from '../packages/editor/src/index.js';
import { openReviewCenter } from '../packages/editor/src/workspace/reviews.js';
import { openPublication } from '../packages/editor/src/workspace/publication.js';
import { openLibrary } from '../packages/editor/src/library/dialog.js';
import { patchCanvas } from '../packages/editor/src/workspace/canvas-patch.js';
import { mountDashboard } from '../studio/web/dashboard.js';
import { enhanceAnalytics } from '../packages/renderer/src/index.js';
const tick = () => new Promise((resolve) => setImmediate(resolve));
const button = (root, label) =>
  [...root.querySelectorAll('button')].find(
    (b) => b.textContent === label || b.getAttribute('aria-label') === label,
  );
const field = (root, label) =>
  root.querySelector(
    '[id="' +
      [...root.querySelectorAll('label')].find((n) => n.textContent === label).htmlFor +
      '"]',
  );
function dom(t, path = '/studio') {
  const w = new Window({
      url: 'https://example.test' + path,
      settings: { disableIframePageLoading: true },
    }),
    host = w.document.createElement('div');
  w.document.body.append(host);
  t.after(() => w.happyDOM.abort());
  return { w, host, root: host.attachShadow({ mode: 'open' }) };
}

test('paged dashboard asks the server for unpublished rows beyond the current slice and preserves query state', async (t) => {
  const { host, w } = dom(t),
    initial = {
      workspace: { sample: true },
      summary: { websites: 101, published: 100, drafts: 1 },
      page: { total: 101, offset: 0, limit: 25, nextOffset: 25 },
      sites: [
        { id: 'first', title: 'Published', published: true, unpublishedChanges: false, version: 1 },
      ],
    };
  const calls = [];
  const app = mountDashboard(host, {
    workspace: initial,
    client: {
      send: async (path) => {
        calls.push(path);
        return {
          sites: [
            {
              id: 'old',
              title: 'Older draft',
              published: false,
              unpublishedChanges: true,
              version: 1,
            },
          ],
          page: { total: 1, offset: 0, limit: 25, nextOffset: null },
        };
      },
    },
  });
  button(host.querySelector('.studio-filters'), 'Unpublished').click();
  await tick();
  assert.match(calls[0], /status=drafts/);
  assert.match(host.textContent, /Older draft/);
  assert.doesNotMatch(host.textContent, /No unpublished changes/);
  assert.equal(new URL(w.location.href).searchParams.get('status'), 'drafts');
  app.destroy();
});
test('dashboard ignores a superseded server filter response', async (t) => {
  const { host } = dom(t);
  const pending = [];
  const app = mountDashboard(host, {
    workspace: {
      workspace: { sample: true },
      sites: [],
      page: { total: 0, offset: 0, limit: 25, nextOffset: null },
    },
    client: { send: () => new Promise((resolve) => pending.push(resolve)) },
  });
  button(host.querySelector('.studio-filters'), 'Published').click();
  button(host.querySelector('.studio-filters'), 'Unpublished').click();
  pending[1]({
    sites: [{ id: 'new', title: 'Latest draft', published: false, unpublishedChanges: true }],
    page: { total: 1, offset: 0, limit: 25, nextOffset: null },
  });
  await tick();
  pending[0]({ sites: [], page: { total: 0, offset: 0, limit: 25, nextOffset: null } });
  await tick();
  assert.match(host.textContent, /Latest draft/);
  app.destroy();
});
test('Enter and Space anchor a guest review to the focused nested heading', async (t) => {
  const { host, w } = dom(t, '/website-review?review=r#secret');
  const doc = createDocument();
  let posted, ready;
  const loaded = new Promise((r) => (ready = r));
  const review = mountReview(host, {
    request: async (_path, options) => {
      if (options?.body?.anchor) posted = options.body.anchor;
      return {
        id: 'r',
        revision: 1,
        document: doc,
        data: {},
        canComment: true,
        canResolve: false,
        threads: [],
      };
    },
    onReady: ready,
  });
  await loaded;
  const root = host.shadowRoot,
    fd = root.querySelector('iframe').contentDocument,
    target = fd.querySelector('[data-wb-type=heading]');
  for (const key of ['Enter', ' ']) {
    target.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true }));
    root.querySelector('input').value = 'Guest';
    root.querySelector('textarea').value = 'A comment';
    button(root, 'Post comment').click();
    await tick();
    assert.equal(posted.nodeId, target.dataset.wbId);
  }
  review.destroy();
});
test('keyed canvas patches preserve media and page nodes through changes and reordering', (t) => {
  const { w } = dom(t);
  const d = w.document;
  d.body.innerHTML =
    '<main data-wb-id="page"><section data-wb-id="a"><img data-wb-id="image" src="/photo.webp"></section><section data-wb-id="b">Before</section></main>';
  const page = d.querySelector('main'),
    image = d.querySelector('img'),
    a = d.querySelector('section');
  patchCanvas(
    d,
    '<main data-wb-id="page"><section data-wb-id="b">After</section><section data-wb-id="a"><img data-wb-id="image" src="/photo.webp"></section></main>',
  );
  assert.equal(d.querySelector('main'), page);
  assert.equal(d.querySelector('img'), image);
  assert.equal(d.querySelector('[data-wb-id=a]'), a);
  assert.equal(page.firstElementChild.textContent, 'After');
});
test('mounted editor updates retain the iframe body and unaffected image identity', async (t) => {
  const { host } = dom(t);
  const doc = createDocument();
  const image = node('image', { assetId: 'photo', alt: 'Example' });
  doc.children[0].children.push(image);
  const editor = mountEditor(host, {
    document: doc,
    data: { assets: { photo: { url: 'https://example.test/photo.webp' } } },
    adapter: {},
  });
  await tick();
  const fd = host.shadowRoot.querySelector('.canvas-frame').contentDocument,
    body = fd.body,
    before = fd.querySelector('img');
  let writes = 0;
  const original = fd.write.bind(fd);
  fd.write = (...args) => {
    writes++;
    return original(...args);
  };
  const next = structuredClone(doc);
  next.children[0].children[0].props.text = 'Changed heading';
  editor.update({ document: next, version: 1 });
  assert.equal(fd.body, body);
  assert.equal(fd.querySelector('img'), before);
  assert.equal(writes, 0);
  editor.destroy();
});
test('font choices expose bundled/system fonts and disable only the selected unavailable legacy family', async () => {
  assert.ok(fontOptions().some((f) => f.value === 'Manrope'));
  assert.ok(fontOptions().some((f) => /system font/.test(f.label)));
  assert.ok(!fontOptions().some((f) => f.value === 'Newsreader'));
  assert.equal(fontOptions('Newsreader').find((f) => f.value === 'Newsreader').disabled, true);
  const css = await readFile(
    new URL('../packages/renderer/src/fonts.css', import.meta.url),
    'utf8',
  );
  assert.match(css, /manrope\.ttf/);
  assert.match(css, /cormorantgaramond\.ttf/);
});
test('readiness separates missing-media blockers from connected-field and content warnings', () => {
  const doc = createDocument();
  const image = node('image', { assetId: 'missing', alt: 'Useful description' });
  doc.children[0].children.push(image);
  doc.children[0].children[0].props.text = { source: 'event', path: 'title' };
  const results = publicationFindings(doc, {});
  assert.ok(results.some((f) => f.id === image.id && f.level === 'blocker'));
  assert.ok(results.some((f) => f.kind === 'binding' && f.level === 'warning'));
  assert.ok(
    !publicationFindings(doc, {
      assets: { missing: { url: 'https://example.test/image.webp' } },
      event: { title: 'Known' },
    }).some((f) => f.kind === 'media' || f.kind === 'binding'),
  );
});
test('publication retains a failed confirmation for retry and blocks a missing image', async (t) => {
  const { root } = dom(t);
  let calls = 0;
  const dialog = openPublication({
    root,
    document: createDocument(),
    data: {},
    adapter: {},
    onSelect: () => {},
    onHistory: () => {},
    onPublish: async () => {
      if (++calls === 1) throw new Error('Offline');
    },
  });
  button(dialog.element, 'Publish').click();
  await tick();
  assert.ok(dialog.element.isConnected);
  assert.match(dialog.element.textContent, /Offline/);
  button(dialog.element, 'Publish').click();
  await tick();
  assert.equal(dialog.element.isConnected, false);
  const broken = createDocument();
  broken.children[0].children.push(node('image', { assetId: 'gone', alt: 'Photo' }));
  const blocked = openPublication({
    root,
    document: broken,
    data: {},
    adapter: {},
    onSelect: () => {},
    onHistory: () => {},
    onPublish: async () => calls++,
  });
  button(blocked.element, 'Publish').click();
  await tick();
  assert.equal(calls, 2);
  assert.match(blocked.element.textContent, /Fix missing media/);
  blocked.close();
});
test('publication checks disabled native RSVP and missing internal link destinations', (t) => {
  const { root } = dom(t);
  const doc = createDocument();
  doc.children[0].children.push(
    node('widget', { widgetId: 'pixelcore.event-rsvp', source: 'event', variant: 'inline' }),
    node('button', { text: 'Go', href: '#does-not-exist' }),
  );
  const dialog = openPublication({
    root,
    document: doc,
    data: {},
    adapter: { capabilities: ['rsvp'], workspace: { rsvpState: 'disabled' } },
    onSelect: () => {},
    onHistory: () => {},
    onPublish: async () => {},
  });
  assert.match(dialog.element.textContent, /RSVP is disabled/);
  assert.match(dialog.element.textContent, /has no destination/);
  dialog.close();
});
test('review center creates access-limited links and manages resolution, expiry, revocation and viewport jump', async (t) => {
  const { root } = dom(t);
  let settings,
    resolved,
    revoked = false,
    jump;
  const row = () => ({
    id: 'r',
    revision: 2,
    expiresAt: '2026-11-01T12:00:00Z',
    canComment: true,
    revoked,
    threads: [
      {
        id: 'thread',
        nodeId: 'heading',
        viewport: 390,
        resolved: !!resolved,
        comments: [{ name: 'Guest', body: 'Please update this.' }],
      },
    ],
  });
  const center = openReviewCenter({
    root,
    create: async (value) => {
      settings = value;
      return { url: 'https://example.test/website-review#secret' };
    },
    adapter: {
      listReviews: async () => ({
        reviews: [{ ...row(), active: !revoked, openCount: 1 }],
        nextOffset: null,
      }),
      readReview: async () => row(),
      updateReview: async (_id, value) => {
        settings = value;
        return row();
      },
      revokeReview: async () => {
        revoked = true;
      },
      resolveReviewThread: async (_id, _thread, value) => {
        resolved = value;
      },
    },
    onJump: (...args) => (jump = args),
  });
  await tick();
  field(root, 'Reviewer access').value = 'view';
  field(root, 'Link expires in days').value = '3';
  button(root, 'Create review link').click();
  await tick();
  assert.deepEqual(settings, { canComment: false, lifetimeDays: 3 });
  assert.match(root.textContent, /shown only when created/);
  root.querySelector('[data-review-id=r]').click();
  await tick();
  button(root, 'Resolve thread').click();
  await tick();
  assert.equal(resolved, true);
  const filter = field(root, 'Discussion filter');
  filter.value = 'resolved';
  filter.dispatchEvent(new root.ownerDocument.defaultView.Event('change'));
  button(root, 'Show element at reviewed width').click();
  assert.deepEqual(jump, ['heading', 390]);
  assert.equal(center.element.isConnected, false);
});
test('review center ignores link reads completed after closing', async (t) => {
  const { root } = dom(t);
  let finish;
  const center = openReviewCenter({
    root,
    adapter: { listReviews: () => new Promise((resolve) => (finish = resolve)) },
    create: async () => {},
    onJump: () => {},
  });
  center.close();
  finish({ reviews: [{ id: 'late', revision: 1, openCount: 0 }], nextOffset: null });
  await tick();
  assert.equal(root.querySelector('dialog'), null);
});
test('saved-library summaries fetch a full design only on selection and expose paging', async (t) => {
  const { root } = dom(t);
  let reads = 0;
  const saved = createDocument();
  const library = openLibrary({
    root,
    kind: 'templates',
    document: createDocument(),
    savedTemplates: [{ id: 'one', name: 'A saved design', version: 1 }],
    nextSavedOffset: 25,
    onLoadSaved: async () => ({
      designs: [{ id: 'two', name: 'Another design' }],
      nextOffset: null,
    }),
    onReadDesign: async () => {
      reads++;
      return { id: 'one', name: 'A saved design', document: saved };
    },
    onChoose: () => {},
    onSaveTemplate: async () => {},
  });
  assert.equal(reads, 0);
  button(root, 'My templates').click();
  assert.ok(button(root, 'Load more saved designs'));
  button(root, 'Preview A saved design').click();
  await tick();
  assert.equal(reads, 1);
  assert.ok(button(root, 'Apply to this page'));
  button(root, 'Load more saved designs').click();
  await tick();
  assert.ok(button(root, 'Preview Another design'));
  library.close();
});
test('template packs show only the selected context while retaining compatibility explanations', (t) => {
  const { root, w } = dom(t);
  const library = openLibrary({
    root,
    kind: 'templates',
    document: createDocument(),
    capabilities: ['event', 'rsvp'],
    workspace: { kind: 'event', sourceName: 'Our wedding' },
    onChoose: () => {},
  });
  const pack = field(root, 'Template pack');
  pack.value = 'recommended';
  pack.dispatchEvent(new w.Event('change'));
  assert.ok(root.querySelector('[aria-label="Preview Wedding editorial"]'));
  assert.ok(!root.querySelector('[aria-label="Preview Storefront editorial"]'));
  button(root, 'Preview Wedding editorial').click();
  assert.match(root.textContent, /Invitation, guest limits/);
  library.close();
});
test('data refresh replaces approved records without editing the design and retains retry after failure', async (t) => {
  const { host } = dom(t);
  let fail = true;
  const doc = createDocument();
  doc.children[0].children[0].props.text = { source: 'identity', path: 'name' };
  const editor = mountEditor(host, {
    document: doc,
    data: { identity: { name: 'Before' } },
    adapter: {
      loadData: async () => {
        if (fail) throw new Error('Source unavailable');
        return { identity: { name: 'After' } };
      },
    },
  });
  const root = host.shadowRoot;
  root.querySelector('[data-tool=data]').click();
  button(root, 'Refresh live data').click();
  await tick();
  assert.match(root.textContent, /last successful data remains/);
  fail = false;
  button(root, 'Retry data refresh').click();
  await tick();
  assert.match(root.querySelector('.canvas-frame').contentDocument.body.textContent, /After/);
  assert.deepEqual(editor.getDocument(), doc);
  editor.destroy();
});
test('visitor choices default off, remain scoped, expire and tolerate unavailable storage', (t) => {
  const { w } = dom(t);
  let time = 1000;
  const a = createConsentStore({
    scope: 'business-a',
    storage: w.localStorage,
    eventTarget: w,
    now: () => time,
  });
  assert.equal(a.value, 'unset');
  a.set('allowed');
  assert.equal(a.value, 'allowed');
  assert.equal(createConsentStore({ scope: 'business-b', storage: w.localStorage }).value, 'unset');
  a.set('denied');
  assert.equal(a.value, 'denied');
  time += 181 * 86400000;
  assert.equal(
    createConsentStore({ scope: 'business-a', storage: w.localStorage, now: () => time }).value,
    'unset',
  );
  assert.notEqual(consentKey('a/b'), consentKey('a?b'));
  a.destroy();
  const blocked = createConsentStore({
    scope: 'blocked',
    storage: {
      getItem() {
        throw Error();
      },
      setItem() {
        throw Error();
      },
    },
  });
  blocked.set('allowed');
  assert.equal(blocked.value, 'allowed');
  blocked.destroy();
});
test('tracking is inert on invitation RSVP and workspace routes even with consent', (t) => {
  const { w } = dom(t, '/event/event-id/rsvp/private-token');
  const config = { provider: 'google', domain: 'example.test', measurementId: 'G-ABCDEFG' };
  enhanceAnalytics(w.document.body, config, { consent: true });
  assert.equal(w.document.querySelectorAll('[data-website-analytics]').length, 0);
  w.location.href = 'https://example.test/workspace/site';
  enhanceAnalytics(w.document.body, config, { consent: true });
  assert.equal(w.document.querySelectorAll('[data-website-analytics]').length, 0);
});

test('revoking a review updates its UI and prevents further access editing', async (t) => {
  const { root } = dom(t);
  let revoked = false;
  const read = () => ({
    id: 'r',
    revision: 1,
    canComment: true,
    expiresAt: '2026-11-01T12:00:00Z',
    revoked,
    threads: [],
  });
  const center = openReviewCenter({
    root,
    adapter: {
      listReviews: async () => ({
        reviews: [{ ...read(), openCount: 0, active: !revoked }],
        nextOffset: null,
      }),
      readReview: async () => read(),
      revokeReview: async () => {
        revoked = true;
      },
    },
    create: async () => {},
    onJump: () => {},
  });
  await tick();
  root.querySelector('[data-review-id=r]').click();
  await tick();
  button(root, 'Revoke link').click();
  await tick();
  assert.equal(revoked, true);
  assert.match(root.textContent, /Revoked/);
  assert.equal(button(root, 'Save link settings'), undefined);
  center.close();
});
test('saved design search requests matching summaries from the server beyond the first page', async (t) => {
  const { root, w } = dom(t);
  const calls = [];
  const library = openLibrary({
    root,
    kind: 'templates',
    document: createDocument(),
    savedTemplates: [{ id: 'first', name: 'First' }],
    onLoadSaved: async (offset, q) => {
      calls.push({ offset, q });
      return { designs: [{ id: 'old', name: 'Older wedding' }], nextOffset: null };
    },
    onReadDesign: async () => ({ id: 'old', name: 'Older wedding', document: createDocument() }),
    onChoose: () => {},
  });
  button(root, 'My templates').click();
  const search = field(root, 'Search designs');
  search.value = 'Older';
  search.dispatchEvent(new w.Event('input'));
  await new Promise((r) => setTimeout(r, 280));
  assert.deepEqual(calls, [{ offset: 0, q: 'Older' }]);
  assert.ok(button(root, 'Preview Older wedding'));
  library.close();
});
test('consent withdrawal disables a loaded Google measurement and signals denied storage', (t) => {
  const { w } = dom(t, '/site/business');
  const root = w.document.body;
  const stop = enhanceAnalytics(
    root,
    { provider: 'google', domain: 'example.test', measurementId: 'G-ABCDEFG' },
    { consent: true },
  );
  w.document.querySelector('[data-website-analytics]').dispatchEvent(new w.Event('load'));
  assert.equal(w['ga-disable-G-ABCDEFG'], false);
  stop();
  assert.equal(w['ga-disable-G-ABCDEFG'], true);
  assert.equal(w.dataLayer.at(-1)[2].analytics_storage, 'denied');
});

test('a failed clean-editor sign-out uses a visible editor dialog instead of clipped outer feedback', async (t) => {
  const { mountStudio } = await import('../studio/web/studio.js');
  const { host } = dom(t, '/studio/builder');
  const doc = createDocument();
  doc.context = { version: 1, purpose: 'storefront', sourceId: 'sample', setupComplete: 1 };
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ components: [] }),
  }));
  const app = mountStudio(host, {
    fetcher: async (path, options) => ({
      ok: options?.method !== 'DELETE',
      status: 503,
      json: async () =>
        options?.method === 'DELETE'
          ? { error: { message: 'Connection interrupted' } }
          : path.includes('/session/')
            ? {
                authenticated: true,
                user: { displayName: 'Owner', source: 'studio' },
                capabilities: { editWebsite: true },
                platforms: [],
              }
            : path.includes('/open/')
              ? {
                  id: 'site',
                  document: doc,
                  data: {},
                  version: 1,
                  capabilities: {
                    workspace: { sourceId: 'sample', sourceName: 'Samples', pages: [] },
                  },
                }
              : { workspace: { sample: true, name: 'Samples' }, sites: [], sources: [] },
    }),
  });
  await app.ready;
  const editorRoot = host.shadowRoot.querySelector('.studio-editor-host').shadowRoot;
  const signOut = button(editorRoot, 'Sign out of Studio');
  assert.ok(signOut, host.shadowRoot.textContent.slice(-800));
  signOut.click();
  await tick();
  assert.match(editorRoot.querySelector('dialog').textContent, /Connection interrupted/);
  assert.equal(host.shadowRoot.querySelector('.studio-main > .studio-feedback'), null);
  app.destroy();
});

test('source chooser pages older platform records and retains its query in the route', async (t) => {
  const { mountSourcePicker } = await import('../studio/web/source-picker.js');
  const { host, w } = dom(t, '/studio/builder?sourceQ=wedding&sourceKind=event');
  let requested;
  const picker = mountSourcePicker(host, {
    workspace: {
      sites: [],
      sources: [{ id: 'one', kind: 'event', title: 'Wedding one' }],
      sourcePage: { total: 30, offset: 0, limit: 25, nextOffset: 25 },
    },
    client: {
      send: async (path) => {
        requested = path;
        return {
          sites: [],
          sources: [{ id: 'older', kind: 'event', title: 'Wedding older' }],
          sourcePage: { total: 30, offset: 25, limit: 25, nextOffset: null },
        };
      },
    },
  });
  button(host, 'More sources').click();
  await tick();
  assert.match(requested, /sourceoffset=25/);
  assert.match(requested, /sourceQ=wedding/);
  assert.match(host.textContent, /Wedding older/);
  assert.match(w.location.search, /sourceKind=event/);
  picker.destroy();
});

test('tracking strips query/hash and referrer paths and suppresses delayed events after private navigation', (t) => {
  const { w } = dom(t, '/site/business?private=secret#token');
  Object.defineProperty(w.document, 'referrer', {
    value: 'https://example.test/event/id/rsvp/private-invitation',
  });
  const stop = enhanceAnalytics(
    w.document.body,
    {
      provider: 'plausible',
      domain: 'example.test',
      scriptUrl: 'https://plausible.io/js/script.js',
    },
    { consent: true },
  );
  const transformed = w.plausible.o.transformRequest({
    n: 'pageview',
    u: w.location.href,
    d: 'example.test',
    r: w.document.referrer,
  });
  assert.equal(transformed.u, 'https://example.test/site/business');
  assert.equal(transformed.r, 'https://example.test');
  w.location.href = 'https://example.test/event/id/rsvp/new-token';
  assert.equal(w.plausible.o.transformRequest({ n: 'pageview' }), null);
  stop();
});
