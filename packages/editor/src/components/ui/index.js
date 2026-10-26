import { icon } from './icons.js';
export { createTooltipProvider } from './tooltip.js';
// Native-DOM ports of the repository-owned Shadcn controls. Keep framework
// adapters out of this layer so standalone Studio does not need a Vue build.
export function input(d, attrs = {}) {
  const { class: className = '', ...rest } = attrs;
  return el(d, 'input', { 'data-slot': 'input', class: 'ui-input ' + className, ...rest });
}
export function textarea(d, attrs = {}) {
  return el(d, 'textarea', { 'data-slot': 'textarea', class: 'ui-textarea', ...attrs });
}
export function nativeSelect(d, attrs = {}) {
  return el(d, 'select', { 'data-slot': 'native-select', class: 'ui-select', ...attrs });
}
export function el(doc, tag, attrs = {}, children = []) {
  const n = doc.createElement(tag);
  for (const [key, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (key === 'text') n.textContent = v;
    else if (key === 'class') n.className = v;
    else if (key.startsWith('on')) n.addEventListener(key.slice(2).toLowerCase(), v);
    else if (key === 'disabled') n.disabled = Boolean(v);
    else n.setAttribute(key, String(v));
  }
  for (const c of [].concat(children))
    if (c) n.append(typeof c === 'string' ? doc.createTextNode(c) : c);
  return n;
}
export function setButtonContent(control, label, glyph) {
  control.replaceChildren();
  if (glyph) {
    const svg = icon(control.ownerDocument, glyph);
    svg.classList.add('button-icon');
    control.append(svg);
  }
  if (label)
    control.append(el(control.ownerDocument, 'span', { class: 'button-label', text: label }));
  return control;
}
export function button(d, label, run, attrs = {}) {
  const { icon: glyph, tooltip, title, ...rest } = attrs;
  const control = el(d, 'button', {
    type: 'button',
    class: 'ui-button',
    onClick: run,
    ...rest,
    ...(tooltip || title
      ? { 'data-tooltip': tooltip || title, 'aria-description': tooltip || title }
      : {}),
  });
  return setButtonContent(control, label, glyph);
}
export function field(
  d,
  label,
  value,
  change,
  { type = 'text', options, min, max, step, readonly = false } = {},
) {
  const id = `field-${globalThis.crypto.randomUUID()}`;
  const wrapper = el(d, 'div', { class: 'ui-field' });
  const createControl = options ? nativeSelect : type === 'textarea' ? textarea : input;
  const control = createControl(d, {
    id,
    ...(!options && type !== 'textarea' ? { type } : {}),
    min,
    max,
    step,
  });
  if (options)
    for (const o of options) {
      const item = typeof o === 'string' ? { value: o, label: o } : o;
      control.append(
        el(d, 'option', { value: item.value, text: item.label, disabled: item.disabled }),
      );
    }
  control.value = value ?? '';
  if (readonly) control.disabled = true;
  if (type === 'textarea') control.style.resize = 'none';
  control.addEventListener('change', () =>
    change(type === 'number' ? Number(control.value) : control.value),
  );
  wrapper.append(el(d, 'label', { for: id, text: label }), control);
  return wrapper;
}
export function filePicker(d, label, change, { accept = '.json,application/json' } = {}) {
  const id = `file-${globalThis.crypto.randomUUID()}`;
  const control = input(d, { id, type: 'file', accept });
  control.addEventListener('change', () => change(control.files?.[0]));
  return el(d, 'div', { class: 'ui-field' }, [el(d, 'label', { for: id, text: label }), control]);
}
export function passwordField(d, label, autocomplete = 'current-password') {
  const wrapper = field(d, label, '', () => {}, { type: 'password' }),
    control = wrapper.querySelector('input');
  control.autocomplete = autocomplete;
  const group = el(d, 'div', { class: 'ui-input-group', 'data-slot': 'input-group' });
  const reveal = button(
    d,
    '',
    () => {
      const visible = control.type === 'password';
      const start = control.selectionStart,
        end = control.selectionEnd;
      control.type = visible ? 'text' : 'password';
      reveal.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
      reveal.setAttribute('aria-pressed', String(visible));
      reveal.dataset.tooltip = reveal.getAttribute('aria-label');
      setButtonContent(reveal, '', visible ? 'eye-off' : 'eye');
      if (start !== null && end !== null) control.setSelectionRange(start, end);
    },
    {
      class: 'ui-button ui-input-action',
      'data-slot': 'input-group-button',
      'aria-label': 'Show password',
      'aria-pressed': 'false',
      'aria-controls': control.id,
      tooltip: 'Show password',
      icon: 'eye',
    },
  );
  group.append(control, reveal);
  wrapper.append(group);
  return { field: wrapper, input: control, reveal };
}
export function modal(
  root,
  title,
  content,
  onConfirm,
  { confirmLabel = 'Apply', danger = false } = {},
) {
  const d = root.ownerDocument,
    previous = root.activeElement;
  const dialog = el(d, 'dialog', { class: 'ui-dialog', 'aria-label': title });
  const actions = el(d, 'div', { class: 'dialog-actions' });
  let pending = false;
  const close = () => {
    dialog.close?.();
    dialog.remove();
    if (previous?.isConnected) previous.focus?.();
    else [...root.querySelectorAll('dialog[open]')].at(-1)?.querySelector('button')?.focus();
  };
  actions.append(
    button(d, 'Cancel', close),
    button(
      d,
      confirmLabel,
      async () => {
        if (pending) return;
        pending = true;
        for (const control of actions.querySelectorAll('button')) control.disabled = true;
        try {
          await onConfirm();
          close();
        } catch (err) {
          error.textContent = err.message;
        } finally {
          pending = false;
          for (const control of actions.querySelectorAll('button')) control.disabled = false;
        }
      },
      { class: `ui-button ${danger ? 'danger' : 'primary'}` },
    ),
  );
  const error = el(d, 'p', { class: 'error', role: 'alert' });
  dialog.append(el(d, 'h2', { text: title }), content, error, actions);
  root.append(dialog);
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  if (dialog.showModal) dialog.showModal();
  else dialog.setAttribute('open', '');
  actions.firstElementChild.focus();
  return { close, element: dialog };
}

export function dragHandle(d) {
  const svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '24');
  svg.setAttribute('aria-hidden', 'true');
  for (const x of [5, 11])
    for (const y of [6, 12, 18]) {
      const dot = d.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);
      dot.setAttribute('r', '1.2');
      dot.setAttribute('fill', 'currentColor');
      svg.append(dot);
    }
  return svg;
}
