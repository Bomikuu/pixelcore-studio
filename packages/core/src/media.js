import { safeUrl, resolveValue } from './document.js';

export function emptyMediaSlots(document, data = {}) {
  const slots = [];
  walkLocal(document, (n) => {
    if (['image', 'video'].includes(n.type)) {
      const value = n.props.assetId;
      if (value?.source === 'item') return;
      if (!resolveValue(value, data)) slots.push({ nodeId: n.id, field: 'assetId', type: n.type });
    }
    if (n.type === 'gallery' && !n.props.assetIds?.length)
      slots.push({ nodeId: n.id, field: 'assetIds', type: 'gallery' });
  });
  return slots;
}

function walkLocal(n, visit) {
  // Linked content is managed in its source editor, never through a copied fallback.
  if (n.type === 'global-section') return;
  visit(n);
  for (const child of n.children || []) walkLocal(child, visit);
}
export function assetReferences(document) {
  const refs = [];
  const add = (id, nodeId, field) => {
    if (typeof id === 'string' && id) refs.push({ id, nodeId, field });
  };
  add(document.seo?.socialImage, document.id, 'socialImage');
  walkLocal(document, (n) => {
    add(n.props.assetId, n.id, 'assetId');
    add(n.props.posterId, n.id, 'posterId');
    for (const id of n.props.assetIds || []) add(id, n.id, 'assetIds');
    for (const style of [n.style, ...Object.values(n.responsive || {})]) {
      add(style?.background?.assetId, n.id, 'background');
      add(style?.background?.posterId, n.id, 'poster');
    }
  });
  return refs;
}
export function missingAssets(document, data = {}) {
  return [...new Set(assetReferences(document).map((r) => r.id))].filter(
    (id) => !safeUrl(data.assets?.[id]?.url, { asset: true }),
  );
}
export function remapAsset(document, from, to) {
  const copy = structuredClone(document);
  if (copy.seo?.socialImage === from) copy.seo.socialImage = to;
  walkLocal(copy, (n) => {
    for (const key of ['assetId', 'posterId']) if (n.props[key] === from) n.props[key] = to;
    if (n.props.assetIds) n.props.assetIds = n.props.assetIds.map((id) => (id === from ? to : id));
    for (const style of [n.style, ...Object.values(n.responsive || {})])
      if (style?.background)
        for (const key of ['assetId', 'posterId'])
          if (style.background[key] === from) style.background[key] = to;
  });
  return copy;
}
