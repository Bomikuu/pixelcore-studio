import { fontCss } from './fonts.js';
import { renderWidget, renderRegion, widgetCss } from './widgets.js';
import {
  validateDocument,
  resolveValue,
  safeUrl,
  walk,
  collectionRows,
  formatValue,
  pageMetadata,
  shadowValues,
} from '@sitebuilder/core';
export const escapeHtml = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const cssName = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const token = (v, theme) => theme.colors[v] || v;
function styles(style, theme, assets) {
  const rules = [];
  for (const [k, v] of Object.entries(style || {}).sort(([a], [b]) =>
    a === 'padding' ? -1 : b === 'padding' ? 1 : 0,
  )) {
    if (['motion', 'freeform', 'background', 'fontFamily'].includes(k)) continue;
    const property =
      k === 'gridColumns'
        ? 'grid-template-columns'
        : k === 'backgroundColor'
          ? 'background'
          : cssName(k);
    const val =
      k === 'gridColumns'
        ? `repeat(${v},minmax(0,1fr))`
        : k === 'boxShadow'
          ? shadowValues[v]
          : ['color', 'backgroundColor', 'borderColor'].includes(k)
            ? token(v, theme)
            : k === 'width'
              ? `${v}%`
              : k === 'letterSpacing'
                ? `${v}em`
                : typeof v === 'number' && !['fontWeight', 'lineHeight', 'opacity'].includes(k)
                  ? `${v}px`
                  : v;
    rules.push(`${property}:${val}`);
  }
  const bg = style?.background;
  if (bg) {
    if (bg.type === 'solid') rules.push(`background-color:${bg.color || theme.colors.background}`);
    if (bg.type === 'gradient')
      rules.push(
        `background:linear-gradient(${bg.angle || 135}deg,${bg.from || theme.colors.surface},${bg.to || theme.colors.background})`,
      );
    if (bg.type === 'image') {
      const url = safeUrl(assets[bg.assetId]?.url, { asset: true });
      if (url)
        rules.push(
          `background-image:linear-gradient(${bg.overlay || '#000000'}${Math.round(
            (bg.opacity ?? 0) * 255,
          )
            .toString(16)
            .padStart(2, '0')},${bg.overlay || '#000000'}${Math.round((bg.opacity ?? 0) * 255)
            .toString(16)
            .padStart(2, '0')}),url("${url.replace(/["()<>]/g, encodeURIComponent)}")`,
          `background-size:${bg.fit || 'cover'}`,
          `background-position:${bg.focal || '50% 50%'}`,
        );
    }
  }
  return rules.join(';');
}
const baseCss = `.wb-component{height:420px;min-height:120px}.wb-accordion details{border-bottom:1px solid var(--wb-border);padding:20px 0}.wb-accordion summary{cursor:pointer;font-weight:600}.wb-accordion details p{margin:16px 0 0;max-width:68ch}.wb-tabs .wb-tab-list:not([hidden]){display:flex;flex-wrap:wrap;gap:8px;border-bottom:1px solid var(--wb-border);margin-bottom:24px}.wb-tabs [role=tab]{background:transparent;color:inherit;font:inherit;border:0;border-bottom:2px solid transparent;padding:12px 16px;cursor:pointer}.wb-tabs [aria-selected=true]{border-color:var(--wb-primary);font-weight:600}.wb-tab-panel[hidden]{display:none}.wb-video{width:100%;max-height:80vh;display:block;background:var(--wb-surface)}.wb-gallery.wb-logos{grid-template-columns:repeat(auto-fit,minmax(100px,1fr));align-items:center}.wb-logos img{width:100%;height:90px;object-fit:contain;padding:12px}.wb-page{box-sizing:border-box;color:var(--wb-text);background:var(--wb-background);font-family:var(--wb-body-font),sans-serif;font-size:var(--wb-base-size);line-height:1.65;overflow-wrap:anywhere}.wb-page *{box-sizing:border-box}.wb-page h1,.wb-page h2,.wb-page h3,.wb-page h4,.wb-page h5,.wb-page h6{font-family:var(--wb-heading-font),serif;font-weight:500;line-height:1.12;letter-spacing:-.025em;text-wrap:balance;max-width:24ch;margin:0 0 .5em}.wb-page h1{font-size:clamp(var(--wb-h1-min),5vw,var(--wb-h1-max))}.wb-page h2{font-size:clamp(var(--wb-h2-min),3.5vw,var(--wb-h2-max))}.wb-page h3{font-size:var(--wb-h3)}.wb-page h4{font-size:var(--wb-h4)}.wb-page h5{font-size:var(--wb-h5)}.wb-page h6{font-size:var(--wb-h6)}.wb-page p{max-width:68ch;margin:0 0 1.5em;white-space:pre-line}.wb-section{padding:64px max(32px,7%);position:relative;isolation:isolate;overflow:hidden}.wb-section>img,.wb-section>figure{margin-top:36px}.wb-container{padding:20px;min-height:24px}.wb-repeater{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.wb-repeater>.wb-empty{grid-column:1/-1}.wb-repeater>[data-wb-type]{min-width:0}.wb-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.wb-page a{color:inherit;text-underline-offset:4px}.wb-page .wb-action{display:inline-flex;align-items:center;justify-content:center;padding:12px 24px;color:var(--wb-onPrimary);background:var(--wb-primary);border-radius:var(--wb-radius);text-decoration:none;font-size:.9em;font-family:var(--wb-body-font),sans-serif;cursor:pointer}.wb-action:hover{filter:brightness(.94)}.wb-page img{max-width:100%;height:auto;display:block;object-fit:cover}.wb-page figure{margin:0}.wb-page figcaption{font-size:.85em;color:var(--wb-muted);padding-top:8px}.wb-gallery,.wb-products{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px}.wb-product img{width:100%;aspect-ratio:4/5;object-fit:cover;background:var(--wb-surface)}.wb-product h3{font:600 1rem var(--wb-body-font),sans-serif;margin:16px 0 4px}.wb-product a{text-decoration:none}.wb-product p{font-size:.9em;margin:0;color:var(--wb-muted)}.wb-empty{padding:24px;background:var(--wb-surface);color:var(--wb-muted);font:400 .9rem var(--wb-body-font),sans-serif}.wb-schedule{list-style:none;margin:0;padding:0}.wb-schedule li{display:grid;grid-template-columns:130px 1fr;gap:24px;padding:20px 0;border-bottom:1px solid var(--wb-border)}.wb-background-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1}.wb-page :focus-visible{outline:3px solid var(--wb-accent);outline-offset:4px}.wb-page [data-motion=fade]{animation:wb-fade var(--motion-duration) var(--motion-easing,ease-out) var(--motion-delay) both}.wb-page [data-motion=rise]{animation:wb-rise var(--motion-duration) var(--motion-easing,ease-out) var(--motion-delay) both}.wb-page [data-motion=slide]{animation:wb-slide var(--motion-duration) var(--motion-easing,ease-out) var(--motion-delay) both}.wb-page [data-motion=scale]{animation:wb-scale var(--motion-duration) var(--motion-easing,ease-out) var(--motion-delay) both}.wb-page [data-motion-trigger=hover],.wb-page [data-motion-trigger=section]:not([data-wb-revealed]){animation:none!important}.wb-page [data-motion-trigger=hover]{transition:transform var(--motion-duration) var(--motion-easing,ease-out),opacity var(--motion-duration) var(--motion-easing,ease-out)}.wb-page [data-motion-trigger=hover][data-motion=scale]:hover{transform:scale(1.025)}.wb-page [data-motion-trigger=hover][data-motion=rise]:hover{transform:translateY(-5px)}.wb-page [data-motion-trigger=hover][data-motion=slide]:hover{transform:translateX(5px)}.wb-page [data-motion-trigger=hover][data-motion=fade]:hover{opacity:.75}@keyframes wb-fade{from{opacity:.25}}@keyframes wb-rise{from{opacity:.25;transform:translateY(20px)}}@keyframes wb-slide{from{opacity:.25;transform:translateX(-20px)}}@keyframes wb-scale{from{opacity:.25;transform:scale(.97)}}@media(prefers-reduced-motion:reduce){.wb-page [data-motion]{animation:none!important}.wb-background-video{display:none}}@media(max-width:700px){.wb-section{padding:40px 22px}.wb-columns,.wb-products,.wb-gallery{grid-template-columns:1fr}.wb-schedule li{grid-template-columns:1fr;gap:4px}.wb-page [data-freeform-child]{position:static!important;width:auto!important;height:auto!important;transform:none!important}.wb-page [data-freeform]{height:auto!important;min-height:0!important}}`;
export function renderPage(document, resolvedData = {}, options = {}) {
  validateDocument(document);
  const theme = document.theme,
    mode = options.mode || 'public',
    assets = resolvedData.assets || {},
    rules = [],
    usedAssets = new Set(),
    widgets = [],
    anchors = new Set(),
    sectionAnchors = new Map(),
    renderedAnchors = new Set(),
    styled = new Set();
  let renderedCount = 0;
  const image = (assetId, alt = undefined, presentation = {}) => {
    const a = assets[assetId];
    if (!a) return '';
    const url = safeUrl(a.url, { asset: true });
    if (!url) return '';
    usedAssets.add(assetId);
    const renditions = (Array.isArray(a.renditions) ? a.renditions : []).filter(
      (r) =>
        safeUrl(r.url, { asset: true }) &&
        Number.isInteger(r.width) &&
        r.width > 0 &&
        r.width <= 6000,
    );
    const srcset = renditions.length
      ? ` srcset="${escapeHtml(renditions.map((r) => `${r.url} ${r.width}w`).join(', '))}" sizes="(max-width:700px) 100vw, 70vw"`
      : '';
    const crop =
      presentation.aspect && presentation.aspect !== 'auto'
        ? `width:100%;aspect-ratio:${presentation.aspect};height:auto;`
        : '';
    const style = ` style="${crop}object-fit:${presentation.fit || 'cover'};object-position:${presentation.focalX ?? 50}% ${presentation.focalY ?? 50}%"`;
    return `<img src="${escapeHtml(url)}" alt="${escapeHtml(presentation.decorative ? '' : (alt ?? a.alt ?? ''))}" loading="lazy" decoding="async"${srcset}${style}${a.width && a.height ? ` width="${Number(a.width)}" height="${Number(a.height)}"` : ''}>`;
  };
  function sectionAnchor(n) {
    if (sectionAnchors.has(n.id)) return sectionAnchors.get(n.id);
    let anchor =
      (n.props.name || 'section')
        .toLowerCase()
        .replace(/^the /, '')
        .replace(/[^a-z0-9]+/g, '-') || 'section';
    const base = anchor;
    let suffix = 1;
    while (anchors.has(anchor)) anchor = `${base}-${n.id.slice(0, 8)}-${suffix++}`;
    anchors.add(anchor);
    sectionAnchors.set(n.id, anchor);
    return anchor;
  }
  walk(document, (n) => {
    if (n.type === 'section') sectionAnchor(n);
  });
  const pageNavigation = document.children
    .filter((n) => n.type === 'section')
    .slice(1)
    .map((n) => ({ label: n.props.name || 'Section', href: '#' + sectionAnchors.get(n.id) }));
  const essentialLinks = pageNavigation.filter((item) => ['#rsvp', '#contact'].includes(item.href));
  const regionData = {
    ...resolvedData,
    navigation: resolvedData.navigation?.length
      ? resolvedData.navigation
      : [
          ...pageNavigation.filter((item) => !essentialLinks.includes(item)).slice(0, 6),
          ...essentialLinks,
        ],
  };
  const render = (n, parent = null, scope = resolvedData, locked = false) => {
    if (++renderedCount > 3000)
      throw new Error('This page expands to too many elements. Reduce the collection page size.');
    const value = (v) => formatValue(v, scope);
    let anchor;
    if (n.type === 'section') {
      anchor = sectionAnchor(n);
      const base = anchor;
      let suffix = 1;
      while (renderedAnchors.has(anchor) || (anchor !== base && anchors.has(anchor)))
        anchor = `${base}-${n.id.slice(0, 8)}-${suffix++}`;
      anchors.add(anchor);
      renderedAnchors.add(anchor);
    }
    const key = locked ? 'data-wb-part' : 'data-wb-id';
    const selector = `.wb-page [${key}="${CSSescape(n.id)}"]`;
    if (!styled.has(selector)) {
      styled.add(selector);
      if (n.type === 'spacer' && n.style?.height === undefined)
        rules.push(`${selector}{height:40px}`);
      const rule = styles(n.style, theme, assets);
      if (rule) rules.push(`${selector}{${rule}}`);
      if (['columns', 'gallery', 'products', 'services', 'repeater'].includes(n.type))
        rules.push(`@media(max-width:700px){${selector}{grid-template-columns:1fr}}`);
      for (const bp of ['tablet', 'phone']) {
        const s = n.responsive?.[bp];
        if (s?.backgroundColor || (s?.background && s.background.type !== 'video'))
          rules.push(
            `@media(max-width:${bp === 'phone' ? 600 : 960}px){${selector}>.wb-background-video{display:none}}`,
          );
        if (s)
          rules.push(
            `@media(max-width:${bp === 'phone' ? 600 : 960}px){${selector}{${styles(s, theme, assets)}}}`,
          );
      }
    }
    const free = n.style?.freeform;
    if (free && parent?.style?.display === 'block' && parent?.style?.height)
      rules.push(
        `@media(min-width:701px){${selector}{position:absolute;left:${free.x}px;top:${free.y}px;width:${free.width}px;min-height:${free.height}px;z-index:${free.z}}}`,
      );
    const motion = n.style?.motion;
    let extra =
      motion && motion.preset !== 'none' && !document.motionDisabled
        ? ` data-motion="${motion.preset}" data-motion-trigger="${motion.trigger || 'entrance'}" style="--motion-duration:${motion.duration}ms;--motion-delay:${motion.delay}ms;--motion-easing:${motion.easing || 'ease-out'}"`
        : '';
    if (free) extra += ' data-freeform-child';
    if (n.style?.height && n.children.some((child) => child.style?.freeform)) {
      extra += ' data-freeform';
      rules.push(`${selector}{height:${n.style.height}px}`);
    }
    const attr = `${key}="${escapeHtml(n.id)}" data-wb-type="${n.type}"${extra}`;
    if (n.type === 'global-section') {
      const section = resolvedData.globalSections?.[n.props.sectionId];
      const copy = structuredClone(section?.node || n.children[0]);
      validateDocument({ ...document, children: [copy] });
      let index = 0;
      walk(copy, (child) => {
        if (child.type === 'global-section')
          throw new Error('Linked sections cannot be recursive.');
        child.id = `${n.id}-g${index++}`;
      });
      return `<div ${attr} class="wb-global-section" data-wb-linked-root="${escapeHtml(n.id)}">${render(copy, n, scope, true)}</div>`;
    }
    if (n.type === 'repeater') {
      const result = collectionRows(scope, n.props);
      const message =
        result.status === 'loading'
          ? 'Loading content…'
          : result.status === 'error'
            ? 'Content could not load. Please try again later.'
            : result.status === 'unavailable'
              ? 'Connect an available collection to show content.'
              : n.props.emptyText || 'No items available.';
      return `<div ${attr} class="wb-repeater" data-wb-total="${result.total}">${result.rows.map((row) => render(n.children[0], n, { ...scope, item: row }, locked)).join('') || `<p class="wb-empty"${mode === 'editor' ? ' role="status"' : ''}>${escapeHtml(message)}</p>`}</div>`;
    }
    let content = n.children.map((c) => render(c, n, scope, locked)).join('');
    const resolvedText = value(n.props.text),
      txt =
        resolvedText === undefined || resolvedText === null || resolvedText === ''
          ? n.props.fallbackText || resolvedText
          : resolvedText,
      bound = n.props.text && typeof n.props.text === 'object';
    const textAttr = `data-wb-field="text"${bound ? ' data-wb-connected="true"' : ''}`;
    if (n.type === 'widget') {
      widgets.push({ id: n.id, widgetId: n.props.widgetId, props: n.props });
      return `<div ${attr} class="wb-widget" data-wb-widget="${escapeHtml(n.props.widgetId)}" data-wb-variant="${escapeHtml(n.props.variant || 'inline')}">${renderWidget(n, resolvedData, mode)}</div>`;
    }
    if (['header', 'footer'].includes(n.type))
      return `<${n.type} ${attr} class="wb-${n.type} wb-${n.type}-${escapeHtml(n.props.variant || 'left')}">${renderRegion(n, regionData, mode)}</${n.type}>`;
    if (n.type === 'spacer') {
      return `<div ${attr} aria-hidden="true"></div>`;
    }
    if (['heading', 'text'].includes(n.type)) {
      const tag = n.type === 'heading' ? `h${n.props.level || 2}` : 'p';
      return `<${tag} ${attr} ${textAttr}>${escapeHtml(txt ?? (mode === 'editor' ? 'Connection unavailable' : ''))}</${tag}>`;
    }
    if (n.type === 'component')
      return `<div ${attr} data-component-id="${escapeHtml(n.props.componentId)}" data-component-version="${n.props.componentVersion}" data-component-settings="${escapeHtml(n.props.componentSettings || '{}')}" class="wb-component" role="region" aria-label="${escapeHtml(n.props.name || 'Interactive component')}"><p>${escapeHtml(n.props.fallbackText || n.props.name || 'Interactive component')}</p></div>`;
    if (n.type === 'button') {
      const url = safeUrl(value(n.props.href));
      return `<a ${attr} class="wb-action"${mode === 'public' && url ? ` href="${escapeHtml(url)}"` : ' aria-disabled="true"'}>${escapeHtml(txt || 'Learn more')}</a>`;
    }
    if (n.type === 'image')
      return `<figure ${attr}>${image(value(n.props.assetId), value(n.props.alt), n.props) || (mode === 'editor' ? '<div class="wb-empty">Choose an image</div>' : '')}${n.props.caption ? `<figcaption>${escapeHtml(n.props.caption)}</figcaption>` : ''}</figure>`;
    if (n.type === 'accordion')
      return `<div ${attr} class="wb-accordion">${n.props.items.map((item) => `<details><summary>${escapeHtml(item.title)}</summary><p>${escapeHtml(item.body)}</p></details>`).join('')}</div>`;
    if (n.type === 'tabs') {
      const prefix = `wb-tabs-${encodeURIComponent(document.id)}-${renderedCount}`;
      return `<div ${attr} class="wb-tabs"><div class="wb-tab-list" hidden>${n.props.items.map((item, i) => `<button type="button" id="${prefix}-tab-${i}" aria-controls="${prefix}-panel-${i}">${escapeHtml(item.title)}</button>`).join('')}</div>${n.props.items.map((item, i) => `<section id="${prefix}-panel-${i}" class="wb-tab-panel"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></section>`).join('')}</div>`;
    }
    if (n.type === 'video') {
      const a = assets[value(n.props.assetId)];
      const url = a?.type === 'video' ? safeUrl(a.url, { asset: true }) : '';
      const poster = safeUrl(assets[n.props.posterId]?.url, { asset: true });
      if (!url)
        return `<div ${attr} class="wb-empty">${mode === 'editor' ? 'Choose a video from your media library.' : 'Video unavailable.'}</div>`;
      usedAssets.add(value(n.props.assetId));
      if (poster) usedAssets.add(n.props.posterId);
      return `<figure ${attr}><video class="wb-video" controls playsinline preload="none" aria-label="${escapeHtml(value(n.props.alt) || 'Video')}" src="${escapeHtml(url)}"${poster ? ` poster="${escapeHtml(poster)}"` : ''}></video>${n.props.caption ? `<figcaption>${escapeHtml(n.props.caption)}</figcaption>` : ''}</figure>`;
    }
    if (n.type === 'divider') return `<hr ${attr}>`;
    if (n.type === 'gallery')
      return `<div ${attr} class="wb-gallery${n.props.variant === 'logos' ? ' wb-logos' : ''}">${(n.props.assetIds || []).map((a) => image(a, undefined, n.props.variant === 'logos' ? { fit: 'contain' } : {})).join('') || '<div class="wb-empty">No images selected.</div>'}</div>`;
    if (['products', 'services'].includes(n.type)) {
      const rows = Array.isArray(resolvedData[n.props.source || n.type])
        ? resolvedData[n.props.source || n.type]
        : [];
      const selected = rows
        .filter((r) => !n.props.collection || r.collection === n.props.collection)
        .slice(0, n.props.limit || 6);
      const cards = selected
        .map((r) => {
          const direct = safeUrl(r.image, { asset: true });
          let img = image(r.assetId, r.name);
          if (!img && direct)
            img = `<img src="${escapeHtml(direct)}" alt="${escapeHtml(r.name)}" loading="lazy" decoding="async">`;
          const href = safeUrl(
            r.href ||
              `${options.baseUrl || ''}/${n.type === 'services' ? 'services' : 'product'}/${encodeURIComponent(r.slug || r.id || '')}`,
          );
          let price = '';
          if (r.base_price !== undefined && Number.isFinite(Number(r.base_price)))
            try {
              price = new Intl.NumberFormat(resolvedData.locale || 'en-PH', {
                style: 'currency',
                currency: resolvedData.currency || 'PHP',
              }).format(Number(r.base_price));
            } catch {
              price = String(r.base_price);
            }
          return `<article class="wb-product"><a${mode === 'public' && href ? ` href="${escapeHtml(href)}"` : ' aria-disabled="true"'}>${img}<h3>${escapeHtml(r.name)}</h3></a><p>${escapeHtml(price || r.summary || '')}</p></article>`;
        })
        .join('');
      return `<div ${attr} class="wb-products">${cards || '<p class="wb-empty">No published items are available.</p>'}</div>`;
    }
    if (n.type === 'event-schedule') {
      const rows = Array.isArray(resolvedData[n.props.source || 'schedule'])
        ? resolvedData[n.props.source || 'schedule']
        : [];
      return `<ol ${attr} class="wb-schedule">${
        rows
          .slice(0, n.props.limit || 20)
          .map(
            (r) =>
              `<li><time>${escapeHtml(r.time || r.start_at || '')}</time><div><strong>${escapeHtml(r.title || r.name)}</strong><p>${escapeHtml(r.location || r.description || '')}</p></div></li>`,
          )
          .join('') || '<li class="wb-empty">The programme is still being prepared.</li>'
      }</ol>`;
    }
    const bg = n.style?.background;
    if (bg?.type === 'video') {
      const a = assets[bg.assetId],
        poster = assets[bg.posterId];
      const url = safeUrl(a?.url, { asset: true }),
        purl = safeUrl(poster?.url, { asset: true });
      if (url) {
        usedAssets.add(bg.assetId);
        content =
          `<video class="wb-background-video" muted loop playsinline preload="none"${purl ? ` poster="${escapeHtml(purl)}"` : ''} src="${escapeHtml(url)}" aria-hidden="true"></video>` +
          content;
        if (purl)
          rules.push(
            `${selector}{background-image:url("${purl.replace(/["()<>]/g, encodeURIComponent)}");background-size:cover}`,
          );
      }
    }
    return `<${n.type === 'section' ? 'section' : 'div'} ${attr} class="wb-${n.type}"${
      n.type === 'section' ? ` id="${escapeHtml(anchor)}"` : ''
    }>${content}</${n.type === 'section' ? 'section' : 'div'}>`;
  };
  const isHostFrame = resolvedData.frame?.owner === 'host';
  const showFrame = isHostFrame && (mode !== 'public' || options.includeFrame);
  const regions = showFrame ? resolvedData.frame.regions || [] : [];
  const headers = document.children.filter((n) => n.type === 'header');
  const footers = document.children.filter((n) => n.type === 'footer');
  const content = document.children.filter((n) => !['header', 'footer'].includes(n.type));
  const header = (isHostFrame ? regions.filter((n) => n.type === 'header') : headers)
    .map((n) => render(n, document))
    .join('');
  const footer = (isHostFrame ? regions.filter((n) => n.type === 'footer') : footers)
    .map((n) => render(n, document))
    .join('');
  const html = content.map((n) => render(n, document)).join('');
  const vars = Object.entries(theme.colors)
    .map(([k, v]) => `--wb-${k}:${v}`)
    .concat([
      `--wb-heading-font:'${theme.headingFont}'`,
      `--wb-body-font:'${theme.bodyFont}'`,
      `--wb-base-size:${theme.baseSize}px`,
      `--wb-h1-min:${theme.baseSize * theme.scale ** 4}px`,
      `--wb-h1-max:${theme.baseSize * theme.scale ** 7}px`,
      `--wb-h2-min:${theme.baseSize * theme.scale ** 3}px`,
      `--wb-h2-max:${theme.baseSize * theme.scale ** 5}px`,
      `--wb-h3:${theme.baseSize * theme.scale ** 2}px`,
      `--wb-h4:${theme.baseSize * theme.scale}px`,
      `--wb-h5:${theme.baseSize}px`,
      `--wb-h6:${theme.baseSize * 0.875}px`,
      `--wb-radius:${theme.radius}px`,
    ])
    .join(';');
  return {
    html: `<style>${fontCss}${baseCss}${widgetCss}${rules.join('')}</style><div class="wb-page" style="${vars}">${header}<${options.landmark === false ? 'div' : 'main'} data-wb-content>${html}</${options.landmark === false ? 'div' : 'main'}>${footer}</div>`,
    widgets,
    head: pageMetadata(document, resolvedData, { mode, noIndex: options.noIndex }),
    assets: [...usedAssets].map((id) => assets[id]).filter(Boolean),
  };
}
function CSSescape(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c.codePointAt(0).toString(16)} `);
}
