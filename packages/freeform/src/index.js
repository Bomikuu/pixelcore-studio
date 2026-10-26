export function enableSection(id) {
  return { type: 'style', id, value: { display: 'block', height: 600, minHeight: 600 } };
}
export function bounds(
  { x, y, width = 240, height = 100, z = 0 },
  container = { width: 1100, height: 600 },
) {
  const w = Math.max(24, Math.min(width, container.width));
  const h = Math.max(24, Math.min(height, container.height));
  return {
    x: Math.max(0, Math.min(x, container.width - w)),
    y: Math.max(0, Math.min(y, container.height - h)),
    width: w,
    height: h,
    z: Math.max(0, Math.min(z, 100)),
  };
}
export function snap(value, grid = 8) {
  return Math.round(value / grid) * grid;
}
export function attachFreeform(element, { initial, container, commit, zoom = 1 }) {
  let active = null;
  const win = element.ownerDocument.defaultView;
  const down = (e) => {
    if (e.button !== 0) return;
    active = { x: e.clientX, y: e.clientY, bounds: { ...initial }, pointerId: e.pointerId };
    element.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!active) return;
    const b = bounds(
      {
        ...active.bounds,
        x: snap(active.bounds.x + (e.clientX - active.x) / zoom),
        y: snap(active.bounds.y + (e.clientY - active.y) / zoom),
      },
      container,
    );
    element.style.transform = `translate(${b.x - active.bounds.x}px,${b.y - active.bounds.y}px)`;
    active.next = b;
  };
  const done = () => {
    if (!active) return;
    const b = active.next;
    active = null;
    element.style.transform = '';
    if (b) commit(b);
  };
  const cancel = () => {
    active = null;
    element.style.transform = '';
  };
  element.addEventListener('pointerdown', down);
  win.addEventListener('pointermove', move);
  win.addEventListener('pointerup', done);
  win.addEventListener('pointercancel', cancel);
  return () => {
    cancel();
    element.removeEventListener('pointerdown', down);
    win.removeEventListener('pointermove', move);
    win.removeEventListener('pointerup', done);
    win.removeEventListener('pointercancel', cancel);
  };
}
