const liveTypes = new Set(['products', 'services', 'event-schedule', 'repeater', 'widget']);

/** Shared header/footer branding can update independently of an authored page body. */
export function liveContentNodes(document, data = {}) {
  const nodes = [];
  const linked = new Set();
  function visit(n) {
    if (['header', 'footer'].includes(n.type)) return;
    if (n.type === 'global-section' && data.globalSections?.[n.props.sectionId]?.node) {
      if (linked.has(n.props.sectionId)) return;
      linked.add(n.props.sectionId);
      visit(data.globalSections[n.props.sectionId].node);
      return;
    }
    const connected = Object.values(n.props || {}).some(
      (value) =>
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        value.source &&
        value.path !== undefined,
    );
    if (liveTypes.has(n.type) || connected) nodes.push(n.id);
    for (const child of n.children || []) visit(child);
  }
  visit(document);
  return nodes;
}

export function prepareContentMode(document, operation = {}, data = {}) {
  if (document.mode !== 'fixed' || !liveContentNodes(document, data).length) return document;
  if (operation.type === 'document' && operation.value?.mode === 'fixed')
    throw new Error(
      'This page still has live sections or connected fields. Remove or detach them before choosing fixed content.',
    );
  // Connecting public data is explicit; update the mode in that same undoable edit.
  return { ...document, mode: 'live' };
}
