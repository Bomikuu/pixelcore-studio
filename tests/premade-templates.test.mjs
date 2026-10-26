import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import axe from 'axe-core';
import {
  createDocument,
  node,
  walk,
  createTemplate,
  parseTemplateJSON,
  checkContrast,
} from '../packages/core/src/index.js';
import { templates, renderPage, applyTemplate } from '../packages/renderer/src/index.js';
import { openLibrary } from '../packages/editor/src/library/dialog.js';
import { openContext } from '../packages/editor/src/workspace/context.js';

const data = {
  identity: {
    name: 'Sample studio',
    description: 'Sample independent studio.',
    address: 'Sample address',
    email: 'hello@example.com',
    phone: '+63 2 1234 5678',
    socials: [
      { platform: 'Instagram', url: 'https://www.instagram.com/example/' },
      { label: 'Our journal', url: 'https://example.com/journal' },
    ],
  },
  event: {
    title: 'Sample couple',
    date: 'Sample date',
    venue: 'Sample venue',
    stories: [{ title: 'A shared beginning', body: 'Sample approved story.' }],
    notes: [{ title: 'Arrival', body: 'Sample arrival details.' }],
  },
  products: [{ name: 'Sample product', base_price: '100', href: '/product/example' }],
  assets: {
    'brand-logo': { url: '/logo.png' },
    hero: { url: '/hero.png', alt: 'Sample landscape' },
    detail: { url: '/detail.png', alt: 'Sample detail' },
  },
};
const button = (root, label) =>
  [...root.querySelectorAll('button')].find((n) => n.textContent === label);
function dom(t) {
  const w = new Window({
    url: 'http://localhost:4173',
    settings: {
      disableCSSFileLoading: true,
      disableIframePageLoading: true,
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
  });
  t.after(() => w.happyDOM.abort());
  w.document.documentElement.lang = 'en';
  const host = w.document.createElement('div');
  w.document.body.append(host);
  return { w, host };
}

test('every premade is a complete portable page with one header, main, footer and useful navigation', (t) => {
  const { host } = dom(t);
  for (const entry of templates) {
    const document = entry.create(data);
    const imported = parseTemplateJSON(
      JSON.stringify(createTemplate({ name: entry.name, document })),
    );
    assert.deepEqual(imported.document, document);
    host.innerHTML = renderPage(document, data).html;
    for (const selector of ['header', 'main', 'footer', 'h1'])
      assert.equal(host.querySelectorAll(selector).length, 1, `${entry.id}: ${selector}`);
    assert.ok(host.querySelectorAll('main > section').length >= 5);
    for (const link of host.querySelectorAll('a[href^="#"]')) {
      assert.ok(
        host.querySelector(link.getAttribute('href')),
        `${entry.id}: missing ${link.getAttribute('href')}`,
      );
    }
    assert.ok(
      host.querySelector(
        'footer [aria-label="Social media"] a[href="https://www.instagram.com/example/"]',
      ),
    );
    assert.equal(
      host.querySelector('footer a[href^="mailto:"]').getAttribute('href'),
      'mailto:hello@example.com',
    );
    assert.equal(
      host.querySelector('footer a[href^="tel:"]').getAttribute('href'),
      'tel:+63212345678',
    );
    walk(document, (n) => {
      if (n.type === 'columns') assert.equal(n.responsive.phone.gridColumns, 1);
      assert.equal(n.style.fontFamily, undefined);
    });
  }
});

test('live templates reflect new records while fixed landing content stays authored', (t) => {
  const { host } = dom(t);
  const shop = applyTemplate('storefront', data),
    landing = applyTemplate('landing', data);
  const changed = structuredClone(data);
  changed.identity.name = 'Updated studio';
  changed.identity.description = 'Updated description';
  changed.products[0].name = 'Updated product';
  changed.event.title = 'Updated couple';
  host.innerHTML = renderPage(shop, changed).html;
  assert.equal(host.querySelector('main h1').textContent, 'Updated studio');
  assert.match(host.querySelector('main').textContent, /Updated product/);
  host.innerHTML = renderPage(landing, changed).html;
  assert.equal(host.querySelector('main h1').textContent, data.identity.name);
  assert.doesNotMatch(host.querySelector('main').textContent, /Updated description/);
  host.innerHTML = renderPage(applyTemplate('event', data), changed, { mode: 'review' }).html;
  assert.equal(host.querySelector('main h1').textContent, 'Updated couple');
  assert.ok(host.querySelector('[data-wb-widget="pixelcore.event-rsvp"]'));
  assert.equal(host.querySelectorAll('form').length, 0);
});

test('missing data leaves readable headings and no fabricated social, image or contact destinations', (t) => {
  const { host } = dom(t);
  for (const entry of templates) {
    host.innerHTML = renderPage(entry.create(), {}).html;
    assert.ok(host.querySelector('h1').textContent.trim());
    assert.equal(host.querySelector('footer [aria-label="Social media"]'), null);
    assert.equal(host.querySelector('footer address'), null);
    assert.equal(host.querySelector('img'), null);
    assert.doesNotMatch(host.innerHTML, /undefined|href="mailto:hello@example.com"/);
  }
});

test('template palettes retain readable body, secondary and button text', () => {
  for (const entry of templates) {
    const { colors } = entry.create().theme;
    for (const background of [colors.background, colors.surface])
      for (const foreground of [colors.text, colors.muted])
        assert.equal(checkContrast({ foreground, background }).status, 'pass', entry.id);
    assert.equal(
      checkContrast({ foreground: colors.onPrimary, background: colors.primary }).status,
      'pass',
      entry.id,
    );
  }
});

test('unsafe social destinations are omitted and reviews keep every footer action inert', (t) => {
  const { host } = dom(t),
    source = structuredClone(data);
  source.identity.socials.push(
    null,
    { platform: '<script>', url: 'javascript:alert(1)' },
    { platform: 'Bad', url: '//example.com' },
    { platform: 'Mail', url: 'mailto:spam@example.com' },
  );
  host.innerHTML = renderPage(applyTemplate('landing', data), source).html;
  assert.equal(host.querySelectorAll('[aria-label="Social media"] a').length, 2);
  for (const link of host.querySelectorAll('[aria-label="Social media"] a'))
    assert.equal(link.rel, 'noopener noreferrer');
  host.innerHTML = renderPage(applyTemplate('landing', data), source, { mode: 'review' }).html;
  assert.equal(host.querySelector('footer a[href]'), null);
  assert.ok(host.querySelector('footer a[aria-disabled=true]'));
});

test('host navigation and frame ownership are preserved; duplicate section names keep unique targets', (t) => {
  const { host } = dom(t),
    document = applyTemplate('landing', data);
  document.children.splice(
    2,
    0,
    node('section', { name: 'About' }, [node('heading', { text: 'Another section', level: 2 })]),
  );
  host.innerHTML = renderPage(document, data).html;
  const ids = [...host.querySelectorAll('section[id]')].map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const link of host.querySelectorAll('nav a[href^="#"]'))
    assert.ok(host.querySelector(link.getAttribute('href')));
  const source = {
    ...data,
    navigation: [{ label: 'All websites', href: '/websites' }],
    frame: { owner: 'host', regions: [node('header'), node('footer')] },
  };
  host.innerHTML = renderPage(document, source, { includeFrame: true }).html;
  assert.equal(host.querySelectorAll('header').length, 1);
  assert.equal(host.querySelectorAll('footer').length, 1);
  assert.equal(host.querySelector('header nav a').getAttribute('href'), '/websites');
  host.innerHTML = renderPage(document, source).html;
  assert.equal(host.querySelector('header'), null);
  assert.equal(host.querySelector('footer'), null);
});

test('template library explains the complete structure and enforces event capabilities', (t) => {
  const { host } = dom(t),
    root = host.attachShadow({ mode: 'open' });
  openLibrary({
    root,
    kind: 'templates',
    document: createDocument(),
    data,
    capabilities: [],
    onChoose: () => assert.fail('Unsupported template applied'),
  });
  root.querySelector('[aria-label="Preview Wedding editorial"]').click();
  assert.match(
    root.querySelector('.library-detail').textContent,
    /Includes: Header.*The programme.*RSVP.*Footer with contact/,
  );
  assert.equal(button(root, 'Apply to this page').disabled, true);
});

test('context setup offers both compatible complete templates and carries approved media into the chosen layout', (t) => {
  const { w, host } = dom(t),
    root = host.attachShadow({ mode: 'open' });
  let result;
  openContext({
    root,
    document: createDocument(),
    data,
    workspace: { purpose: 'landing', features: [] },
    onApply: (doc) => (result = doc),
  });
  button(root, 'Continue').click();
  const select = root.querySelector('select');
  assert.ok(select.querySelector('option[value="landing-minimal"]'));
  assert.ok(select.querySelector('option[value="landing-image-led"]'));
  assert.equal(select.querySelector('option[value="wedding-editorial"]'), null);
  select.value = 'landing-image-led';
  select.dispatchEvent(new w.Event('change'));
  button(root, 'Continue').click();
  button(root, 'Open studio').click();
  assert.equal(result.children[1].style.background.assetId, 'hero');
  assert.equal(result.children[1].children[0].props.text, data.identity.name);
});

test('premade pages expose named landmarks, links, images and valid heading hierarchy', async (t) => {
  const { w, host } = dom(t);
  w.eval(axe.source);
  for (const entry of templates) {
    host.innerHTML = renderPage(entry.create(data), data).html;
    const result = await w.axe.run(host, {
      runOnly: {
        type: 'rule',
        values: [
          'image-alt',
          'link-name',
          'heading-order',
          'landmark-one-main',
          'landmark-unique',
          'aria-allowed-attr',
          'aria-valid-attr-value',
        ],
      },
    });
    assert.equal(
      result.violations.length,
      0,
      `${entry.id}: ${JSON.stringify(result.violations.map((v) => v.id))}`,
    );
  }
});
