import { mountEditor, createDjangoAdapter } from '@sitebuilder/editor';
import { applyTemplate, renderPage, enhancePage } from '@sitebuilder/renderer';
import { createJsonClient, pageHead } from '@sitebuilder/core';
const host = document.querySelector('#app');
async function start() {
  if (location.pathname === '/website-review') {
    const { mountReview } = await import('@sitebuilder/review');
    mountReview(host);
    return;
  }
  const { send } = createJsonClient({ baseUrl: '/api/' });
  let setup = location.pathname === '/published' ? {} : await send('demo/bootstrap/');
  if (location.pathname !== '/published' && !setup.document)
    setup = await send('demo/bootstrap/', {
      method: 'POST',
      body: { document: applyTemplate('storefront') },
    });
  if (location.pathname === '/published') {
    const published = await send('demo/published/');
    const output = renderPage(published.document, published.data);
    const head = pageHead(published.document, published.data, { noIndex: true });
    document.title = head.title;
    for (const item of head.meta) {
      const selector = item.name
        ? `meta[name="${item.name}"]`
        : `meta[property="${item.property}"]`;
      document.head.querySelector(selector)?.remove();
      const meta = document.createElement('meta');
      for (const [key, value] of Object.entries(item)) meta.setAttribute(key, value);
      document.head.append(meta);
    }
    for (const item of head.link) {
      const link = document.createElement('link');
      for (const [key, value] of Object.entries(item)) link.setAttribute(key, value);
      document.head.append(link);
    }
    host.innerHTML = output.html;
    enhancePage(host);
    if (host.querySelector('[data-component-id]')) {
      const { enhanceComponents } = await import('@sitebuilder/components');
      await enhanceComponents(host, {
        catalogUrl: location.origin + '/api/studio/catalog/',
        theme: published.document.theme,
      });
    }
    return;
  }
  const caps = setup.capabilities || {};
  const adapter = createDjangoAdapter({
    websiteId: setup.id,
    capabilities: caps.features,
    sources: caps.sources,
    dataSources: caps.dataSources,
    brandKit: caps.brandKit,
    workspace: caps.workspace,
  });
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Standalone Studio');
  nav.style.cssText =
    'height:36px;display:flex;align-items:center;justify-content:flex-end;gap:20px;padding:0 20px;background:#fff;color:#2448d8;font:12px system-ui,sans-serif';
  const labLink = document.createElement('a');
  labLink.href = '/studio/components';
  labLink.textContent = 'Component Lab';
  nav.append(labLink);
  host.before(nav);
  host.style.height = 'calc(100% - 36px)';
  const syncNav = () => {
    nav.style.background = host.style.getPropertyValue('--editor-surface') || '#ffffff';
    nav.style.color = host.style.getPropertyValue('--editor-focus') || '#2448d8';
  };
  const appearanceObserver = new MutationObserver(syncNav);
  appearanceObserver.observe(host, {
    attributes: true,
    attributeFilter: ['data-editor-appearance'],
  });
  addEventListener('pagehide', () => appearanceObserver.disconnect(), { once: true });
  mountEditor(host, {
    componentCatalog: { url: location.origin + '/api/studio/catalog/' },
    document: setup.document,
    version: setup.version,
    data: setup.data,
    adapter,
    demo: true,
    showSetup: true,
  });
}
start().catch((error) => {
  host.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'boot';
  const h = document.createElement('h1');
  h.textContent = 'The editor could not open';
  const p = document.createElement('p');
  p.textContent = error.message;
  const b = document.createElement('button');
  b.textContent = 'Try again';
  b.addEventListener('click', () => location.reload());
  panel.append(h, p, b);
  host.append(panel);
});
