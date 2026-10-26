/** One delegated tooltip per editor, outside scrolling/clipping panels. */
export function createTooltipProvider(root, { delay = 350 } = {}) {
  const d = root.ownerDocument,
    w = d.defaultView;
  const tip = d.createElement('div');
  tip.className = 'ui-tooltip';
  tip.id = `tooltip-${globalThis.crypto.randomUUID()}`;
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  root.append(tip);
  let active,
    timer,
    hideTimer,
    destroyed = false;
  const cancel = () => {
    w.clearTimeout(timer);
    w.clearTimeout(hideTimer);
  };
  const hide = () => {
    cancel();
    tip.hidden = true;
    if (active) {
      const ids = (active.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter((id) => id && id !== tip.id);
      ids.length
        ? active.setAttribute('aria-describedby', ids.join(' '))
        : active.removeAttribute('aria-describedby');
    }
    active = null;
  };
  const show = (trigger) => {
    hide();
    if (destroyed || !root.contains(trigger)) return;
    active = trigger;
    tip.textContent = trigger.dataset.tooltip;
    tip.hidden = false;
    const ids = (trigger.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    trigger.setAttribute('aria-describedby', [...ids, tip.id].join(' '));
    const a = trigger.getBoundingClientRect(),
      b = tip.getBoundingClientRect();
    const right = trigger.dataset.tooltipPlacement === 'right';
    let left = right ? a.right + 10 : a.left + (a.width - b.width) / 2;
    let top = right ? a.top + (a.height - b.height) / 2 : a.bottom + 10;
    if (right && left + b.width > w.innerWidth - 8) left = a.left - b.width - 10;
    if (top + b.height > w.innerHeight - 8) top = a.top - b.height - 10;
    tip.style.left = `${Math.max(8, Math.min(left, w.innerWidth - b.width - 8))}px`;
    tip.style.top = `${Math.max(8, Math.min(top, w.innerHeight - b.height - 8))}px`;
  };
  const triggerFor = (e) => e.target.closest?.('[data-tooltip]');
  const enter = (e) => {
    if (tip.contains(e.target)) {
      w.clearTimeout(hideTimer);
      return;
    }
    const trigger = triggerFor(e);
    if (!trigger || trigger.contains(e.relatedTarget)) return;
    hide();
    timer = w.setTimeout(() => show(trigger), delay);
  };
  const leave = (e) => {
    const trigger = triggerFor(e);
    if (
      trigger?.contains(e.relatedTarget) ||
      tip.contains(e.relatedTarget) ||
      active?.contains(e.relatedTarget)
    )
      return;
    if (trigger || tip.contains(e.target)) {
      w.clearTimeout(timer);
      hideTimer = w.setTimeout(hide, 100);
    }
  };
  const focus = (e) => {
    const trigger = triggerFor(e);
    if (trigger) show(trigger);
  };
  const blur = (e) => {
    if (!tip.contains(e.relatedTarget)) hide();
  };
  const escape = (e) => {
    if (e.key === 'Escape' && !tip.hidden) {
      hide();
      e.stopPropagation();
    }
  };
  const events = [
    ['pointerover', enter],
    ['pointerout', leave],
    ['focusin', focus],
    ['focusout', blur],
    ['keydown', escape],
    ['click', hide],
  ];
  for (const [name, fn] of events) root.addEventListener(name, fn);
  root.addEventListener('scroll', hide, true);
  w.addEventListener('resize', hide);
  return {
    hide,
    element: tip,
    destroy() {
      destroyed = true;
      hide();
      for (const [name, fn] of events) root.removeEventListener(name, fn);
      root.removeEventListener('scroll', hide, true);
      w.removeEventListener('resize', hide);
      tip.remove();
    },
  };
}
