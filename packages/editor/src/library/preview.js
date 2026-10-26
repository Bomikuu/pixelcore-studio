import { renderPage } from '@sitebuilder/renderer';
import { el, button, field } from '../components/ui/index.js';

export function previewSource(document, data, { thumbnail = false } = {}) {
  const rendered = renderPage(document, data, { mode: 'review' });
  return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';img-src https: http:;media-src https: http:;style-src 'unsafe-inline';font-src 'self' https: http:"><style>html{scrollbar-gutter:stable}body{margin:0}${thumbnail ? '*{pointer-events:none}html{scrollbar-width:none}' : ''}</style></head><body tabindex="0">${rendered.html}</body></html>`;
}

const previewCss = `
.template-preview-dialog{width:min(1440px,calc(100vw - 32px));height:calc(100dvh - 32px);max-height:none;padding:0;overflow:hidden;border:1px solid var(--editor-border);border-radius:12px;background:var(--editor-surface);color:var(--editor-text);font:13px/1.5 var(--editor-font);color-scheme:var(--editor-colorScheme)}
.template-preview-dialog[open]{display:flex;flex-direction:column}.template-preview-dialog::backdrop{background:color-mix(in srgb,var(--editor-overlay) 65%,transparent)}
.template-preview-dialog .ui-button,.template-preview-controls [data-slot="native-select"]{min-height:44px}.template-preview-scrollport:focus-visible{outline:2px solid var(--editor-focus);outline-offset:-4px}
.template-preview-header,.template-preview-controls{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;padding:20px 24px;border-bottom:1px solid var(--editor-border)}.template-preview-header h2{font-size:20px;margin:0 0 4px}.template-preview-header p{margin:0;color:var(--editor-muted)}.template-preview-controls{padding:12px 24px}.template-preview-devices{display:flex;flex-wrap:wrap;gap:8px}.template-preview-devices .ui-button[aria-pressed=true]{background:var(--editor-selected);outline:1px solid var(--editor-focus)}.template-preview-controls .ui-field{margin:0;display:flex;align-items:center;gap:12px}.template-preview-controls label{margin:0}
.template-preview-scrollport{flex:1;min-height:0;overflow:auto;background:var(--editor-background);padding:20px;scrollbar-gutter:stable}.template-preview-scaled{position:relative;margin:0 auto}.template-preview-frame{display:block;max-width:none;border:0;transform-origin:top left;background:var(--editor-canvas);color-scheme:light}.template-preview-frame:focus-visible{outline:2px solid var(--editor-focus);outline-offset:4px}.template-preview-help{padding:12px 24px;margin:0;color:var(--editor-muted);border-top:1px solid var(--editor-border)}
@media(max-width:650px){.template-preview-dialog{width:100vw;height:100dvh;border-radius:0;margin:0}.template-preview-header,.template-preview-controls{padding:16px}.template-preview-scrollport{padding:12px}.template-preview-help{padding:12px 16px}}
`;

export function openDesignPreview({ root, name, document, data = {}, onClose }) {
  const d = root.ownerDocument,
    w = d.defaultView,
    previous = root.activeElement;
  let width = 1280,
    fit = true,
    closed = false;
  const dialog = el(d, 'dialog', {
    class: 'template-preview-dialog',
    'aria-label': name + ' full-page preview',
  });
  const status = el(d, 'p', { role: 'status', text: '' });
  const frame = el(d, 'iframe', {
    title: name + ' full-page preview',
    tabindex: '0',
    sandbox: '',
    class: 'template-preview-frame',
    srcdoc: previewSource(document, data),
  });
  const scaled = el(d, 'div', { class: 'template-preview-scaled' }, [frame]);
  const viewport = el(
    d,
    'div',
    {
      class: 'template-preview-scrollport',
      role: 'region',
      'aria-label': 'Preview canvas',
      tabindex: '0',
    },
    [scaled],
  );
  const devices = el(d, 'div', {
    class: 'template-preview-devices',
    role: 'group',
    'aria-label': 'Preview device',
  });
  function adjust() {
    if (closed) return;
    const available = Math.max(200, (viewport.clientWidth || w.innerWidth - 64) - 40);
    const scale = fit ? Math.min(1, available / width) : 1;
    frame.width = String(width);
    frame.height = '900';
    frame.style.width = width + 'px';
    frame.style.height = '900px';
    frame.style.transform = `scale(${scale})`;
    scaled.style.width = width * scale + 'px';
    scaled.style.height = 900 * scale + 'px';
    const label = width === 1280 ? 'Desktop' : width === 768 ? 'Tablet' : 'Phone';
    status.textContent = `${label} · ${width}px · ${Math.round(scale * 100)}% · Read-only preview`;
    for (const control of devices.querySelectorAll('button'))
      control.setAttribute('aria-pressed', String(Number(control.dataset.width) === width));
  }
  for (const [value, label] of [
    [1280, 'Desktop'],
    [768, 'Tablet'],
    [390, 'Phone'],
  ])
    devices.append(
      button(
        d,
        label,
        () => {
          width = value;
          adjust();
        },
        { 'data-width': value, 'aria-pressed': value === width },
      ),
    );
  const observer = w.ResizeObserver ? new w.ResizeObserver(adjust) : null;
  const close = () => {
    if (closed) return;
    closed = true;
    observer?.disconnect();
    w.removeEventListener('resize', adjust);
    frame.removeAttribute('srcdoc');
    dialog.close?.();
    dialog.remove();
    if (previous?.isConnected) previous.focus();
    onClose?.();
  };
  const dismiss = button(d, 'Close preview', close, { icon: 'close' });
  dialog.append(
    el(d, 'style', { text: previewCss }),
    el(d, 'header', { class: 'template-preview-header' }, [
      el(d, 'div', {}, [el(d, 'h2', { text: name }), status]),
      dismiss,
    ]),
    el(d, 'div', { class: 'template-preview-controls' }, [
      devices,
      field(
        d,
        'Zoom',
        'fit',
        (value) => {
          fit = value === 'fit';
          adjust();
        },
        {
          options: [
            { value: 'fit', label: 'Fit to window' },
            { value: 'actual', label: '100% · actual size' },
          ],
        },
      ),
    ]),
    viewport,
    el(d, 'p', {
      class: 'template-preview-help',
      text: 'Scroll inside the page to inspect every section and the footer. Tab into the preview, then use Page Down or the arrow keys to scroll. Links and guest submissions stay inactive.',
    }),
  );
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  root.append(dialog);
  if (dialog.showModal) dialog.showModal();
  else dialog.setAttribute('open', '');
  observer?.observe(viewport);
  w.addEventListener('resize', adjust);
  adjust();
  dismiss.focus();
  return { close, element: dialog };
}
