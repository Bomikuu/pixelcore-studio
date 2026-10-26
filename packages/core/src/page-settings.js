import { safeUrl, walk, resolveValue } from './document.js';

export function validatePageSettings(seo) {
  if (seo === undefined) return;
  if (!seo || typeof seo !== 'object' || Array.isArray(seo))
    throw new Error('Invalid page settings.');
  const bounds = {
    title: 180,
    description: 500,
    socialTitle: 180,
    socialDescription: 500,
    socialImage: 160,
    canonical: 3000,
  };
  if (Object.keys(seo).some((k) => ![...Object.keys(bounds), 'noIndex'].includes(k)))
    throw new Error('Unsupported page setting.');
  for (const [key, max] of Object.entries(bounds))
    if (seo[key] !== undefined && (typeof seo[key] !== 'string' || seo[key].length > max))
      throw new Error(`Invalid ${key}.`);
  if (
    seo.canonical &&
    (!safeUrl(seo.canonical, { asset: true }) || !/^https?:\/\//i.test(seo.canonical))
  )
    throw new Error('Use a complete HTTP or HTTPS canonical URL.');
  if (seo.noIndex !== undefined && typeof seo.noIndex !== 'boolean')
    throw new Error('Invalid indexing choice.');
}

export function pageMetadata(document, data = {}, { mode = 'public', noIndex = false } = {}) {
  const seo = document.seo || {};
  const title = seo.title || document.title;
  const image = safeUrl(data.assets?.[seo.socialImage]?.url, { asset: true });
  return {
    title,
    description: seo.description || '',
    robots: mode !== 'public' || noIndex || seo.noIndex ? 'noindex,nofollow' : 'index,follow',
    canonical: seo.canonical || '',
    socialTitle: seo.socialTitle || title,
    socialDescription: seo.socialDescription || seo.description || '',
    socialImage: image,
  };
}

export function pageFindings(document, data = {}) {
  const findings = [];
  let h1 = 0,
    previous = 0;
  walk(document, (n) => {
    if (n.type === 'heading') {
      const level = n.props.level || 2;
      if (level === 1) h1++;
      if (previous && level > previous + 1)
        findings.push({ id: n.id, message: 'Heading skips a level. Keep a clear page outline.' });
      previous = level;
    }
    if (
      n.type === 'image' &&
      !String(resolveValue(n.props.alt, data) ?? '').trim() &&
      !n.props.decorative
    )
      findings.push({ id: n.id, message: 'Add alt text or mark this image as decorative.' });
  });
  if (h1 !== 1)
    findings.unshift({
      id: document.id,
      message: h1
        ? 'Use one main heading (H1) per page.'
        : 'Add a main heading (H1) to describe this page.',
    });
  if (!document.seo?.description)
    findings.push({ id: document.id, message: 'Add a search description for this page.' });
  return findings;
}

/** Framework-neutral head descriptor. Hosts retain stricter indexing and routing defaults. */
export function pageHead(document, data = {}, options = {}) {
  const metadata = pageMetadata(document, data, options);
  const description = metadata.description || options.description || '';
  const canonical = metadata.canonical || options.canonical || '';
  return {
    title: metadata.title,
    meta: [
      { name: 'description', content: description },
      { name: 'robots', content: metadata.robots },
      { property: 'og:title', content: metadata.socialTitle },
      { property: 'og:description', content: metadata.socialDescription || description },
      ...(metadata.socialImage ? [{ property: 'og:image', content: metadata.socialImage }] : []),
      { name: 'twitter:card', content: metadata.socialImage ? 'summary_large_image' : 'summary' },
    ],
    link: canonical ? [{ rel: 'canonical', href: canonical }] : [],
  };
}
