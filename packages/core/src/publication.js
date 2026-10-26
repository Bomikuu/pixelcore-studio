import { walk, resolveValue, safeUrl } from './document.js';
import { pageFindings } from './page-settings.js';
import { assetReferences, missingAssets, emptyMediaSlots } from './media.js';
import { liveContentNodes } from './content-mode.js';
import { contrastFindings } from './theme.js';
export function publicationFindings(document, data = {}, capabilities) {
  const findings = pageFindings(document, data).map((f) => ({
    ...f,
    level: 'warning',
    kind: 'content',
  }));
  const missing = new Set(missingAssets(document, data));
  if (document.mode === 'fixed' && liveContentNodes(document, data).length)
    findings.push({
      id: document.id,
      level: 'blocker',
      kind: 'mode',
      message:
        'This fixed page contains live content. Choose Live data in page settings, or remove or detach its connected sections.',
    });
  for (const slot of emptyMediaSlots(document, data))
    findings.push({
      id: slot.nodeId,
      level: 'warning',
      kind: 'media',
      message: `Empty ${slot.type} slot. Choose media or remove this element for a text-only layout.`,
    });
  for (const ref of assetReferences(document))
    if (missing.has(ref.id))
      findings.push({
        id: ref.nodeId,
        level: 'blocker',
        kind: 'media',
        message: 'Missing media: ' + ref.id,
      });
  walk(document, (n) => {
    for (const [field, value] of Object.entries(n.props || {})) {
      if (
        value &&
        typeof value === 'object' &&
        value.source &&
        value.source !== 'item' &&
        resolveValue(value, data) === undefined
      )
        findings.push({
          id: n.id,
          level: 'warning',
          kind: 'binding',
          message: `${field} has an unavailable connected field: ${value.source}.${value.path}`,
        });
    }
    if (n.type === 'button') {
      const href = resolveValue(n.props.href, data);
      if (!href || !safeUrl(String(href)))
        findings.push({
          id: n.id,
          level: 'warning',
          kind: 'link',
          message: 'Button needs a valid link destination.',
        });
    }
    if (n.type === 'repeater') {
      const rows = String(n.props.source || '')
        .split('.')
        .reduce(
          (v, k) => (v && typeof v === 'object' && Object.hasOwn(v, k) ? v[k] : undefined),
          data,
        );
      if (!Array.isArray(rows))
        findings.push({
          id: n.id,
          level: 'warning',
          kind: 'binding',
          message: 'Collection is unavailable. Visitors will see its empty state.',
        });
    }
    if (n.props?.widgetId === 'pixelcore.event-rsvp')
      findings.push({
        id: n.id,
        level:
          Array.isArray(capabilities) && !capabilities.includes('rsvp') ? 'blocker' : 'warning',
        kind: 'rsvp',
        message:
          Array.isArray(capabilities) && !capabilities.includes('rsvp')
            ? 'RSVP is not available in this context.'
            : 'RSVP uses your event’s invitation and response rules. Confirm its open/closed state in PixelCore.',
      });
  });
  for (const finding of contrastFindings(document))
    if (finding.status !== 'pass')
      findings.push({
        id: finding.id || document.id,
        level: 'warning',
        kind: 'contrast',
        message:
          finding.status === 'fail'
            ? `${finding.type} contrast ${finding.ratio.toFixed(2)}:1; requires ${finding.required}:1.`
            : 'Media/background contrast needs review.',
      });
  return findings;
}
export function revisionSummary(current, live) {
  if (!live) return 'First publication of this website.';
  const index = (doc) => {
    const map = new Map();
    walk(doc, (n) =>
      map.set(n.id, JSON.stringify({ ...n, children: (n.children || []).map((c) => c.id) })),
    );
    return map;
  };
  const before = index(live),
    after = index(current);
  let added = 0,
    removed = 0,
    changed = 0;
  for (const [id, value] of after)
    if (!before.has(id)) added++;
    else if (before.get(id) !== value) changed++;
  for (const id of before.keys()) if (!after.has(id)) removed++;
  return `${added} added · ${removed} removed · ${changed} changed elements · ${JSON.stringify(current.theme) === JSON.stringify(live.theme) ? 'Theme unchanged' : 'Theme changed'}`;
}
