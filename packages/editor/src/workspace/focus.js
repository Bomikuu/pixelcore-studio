export function canvasElement(frame, id, documentId) {
  return (
    [...(frame.contentDocument?.querySelectorAll('[data-wb-id]') || [])].find(
      (n) => n.dataset.wbId === id,
    ) || (id === documentId ? frame.contentDocument?.querySelector('[data-wb-content]') : null)
  );
}

export function revealCanvasElement(target, frame, stage, zoom) {
  if (!target || !stage.clientHeight) return;
  const a = target.getBoundingClientRect(),
    f = frame.getBoundingClientRect(),
    s = stage.getBoundingClientRect();
  const top = f.top - s.top + a.top * zoom,
    bottom = top + a.height * zoom;
  if (top >= 12 && bottom <= stage.clientHeight - 12) return;
  const position =
    stage.scrollTop +
    top -
    Math.max(12, (stage.clientHeight - Math.min(a.height * zoom, stage.clientHeight)) / 2);
  stage.scrollTo?.({ top: Math.max(0, position), behavior: 'auto' });
}

/** Restore an existing control after a committed edit without moving selection or rewriting input. */
export function captureWorkspaceFocus(root, areas, frame) {
  const active = root.activeElement;
  if (!active || active === frame) return null;
  for (const [key, area] of Object.entries(areas)) {
    if (!area.contains(active)) continue;
    const field = active.closest('.ui-field');
    const controls = field
      ? [...area.querySelectorAll('.ui-field input,.ui-field select,.ui-field textarea')]
      : [...area.querySelectorAll('button,summary')];
    const label = field?.querySelector('label')?.textContent;
    const name = active.getAttribute('aria-label') || active.textContent;
    const peers = controls.filter((n) =>
      field
        ? n.closest('.ui-field')?.querySelector('label')?.textContent === label
        : (n.getAttribute('aria-label') || n.textContent) === name,
    );
    return {
      key,
      field: Boolean(field),
      label,
      name,
      index: peers.indexOf(active),
      start: active.selectionStart,
      end: active.selectionEnd,
    };
  }
  return null;
}
export function restoreWorkspaceFocus(snapshot, areas) {
  if (!snapshot) return;
  const area = areas[snapshot.key];
  const controls = [
    ...area.querySelectorAll(
      snapshot.field ? '.ui-field input,.ui-field select,.ui-field textarea' : 'button,summary',
    ),
  ];
  const peers = controls.filter((n) =>
    snapshot.field
      ? n.closest('.ui-field')?.querySelector('label')?.textContent === snapshot.label
      : (n.getAttribute('aria-label') || n.textContent) === snapshot.name,
  );
  const next = peers[snapshot.index];
  next?.focus({ preventScroll: true });
  if (
    (next &&
      typeof snapshot.start === 'number' &&
      ['text', 'search', 'url', 'tel', 'password'].includes(next.type)) ||
    next?.tagName === 'TEXTAREA'
  ) {
    try {
      next.setSelectionRange(snapshot.start, snapshot.end);
    } catch {}
  }
}
