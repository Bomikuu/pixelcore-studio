import { el, button } from '../components/ui/index.js';
import { renderBrandPanel } from '../inspectors/index.js';
import { renderMediaPanel } from './media-panel.js';
import { renderGlobalSections } from './global-sections.js';
import { renderDataPanel } from './data-panel.js';
import { captureWorkspaceFocus, restoreWorkspaceFocus } from './focus.js';
import { renderPage } from '@sitebuilder/renderer';

export const workspaceTools = {
  brand: {
    title: 'Theme & branding',
    description: 'Shape your website’s colors and global typography.',
    icon: 'theme',
    render: renderBrandPanel,
  },
  media: {
    title: 'Media library',
    description: 'Choose from your project’s media, or add an image.',
    icon: 'media',
    render: renderMediaPanel,
  },
  globals: {
    title: 'Shared sections',
    description: 'Create, edit and publish designs shared across your pages.',
    icon: 'shared',
    render: renderGlobalSections,
  },
  data: {
    title: 'Connected data',
    description: 'Choose the approved information your website reads from your system.',
    icon: 'data',
    render: renderDataPanel,
  },
};

/** One reusable modal workspace. Page navigation and element properties remain on the canvas. */
export function openToolsDialog({
  root,
  key,
  getContext,
  onClose = () => {},
  onSwitch = () => {},
}) {
  const d = root.ownerDocument,
    previous = root.activeElement;
  const dialog = el(d, 'dialog', { class: 'tool-dialog', 'aria-label': workspaceTools[key].title });
  const title = el(d, 'h2'),
    description = el(d, 'p', {
      class: 'muted',
      id: `tool-description-${globalThis.crypto.randomUUID()}`,
    });
  dialog.setAttribute('aria-describedby', description.id);
  const navigation = el(d, 'nav', { class: 'tool-dialog-tabs', 'aria-label': 'Workspace tools' });
  const body = el(d, 'div', { class: 'tool-dialog-body' });
  const feedback = el(d, 'p', { class: 'tool-dialog-feedback', role: 'status', hidden: true });
  const state = { media: {}, brand: {} };
  let current = key,
    closed = false,
    lastDocument,
    lastData,
    lastSelection,
    rendered;
  const close = ({ restoreFocus = true } = {}) => {
    if (closed) return;
    closed = true;
    body.replaceChildren();
    dialog.close?.();
    dialog.remove();
    onClose();
    if (restoreFocus)
      (previous?.isConnected ? previous : root.querySelector(`[data-tool="${current}"]`))?.focus({
        preventScroll: true,
      });
  };
  const dismiss = button(d, 'Close', () => close(), {
    'aria-label': 'Close workspace tools',
    icon: 'close',
  });
  dialog.append(
    el(d, 'header', { class: 'tool-dialog-header' }, [
      el(d, 'div', {}, [title, description]),
      dismiss,
    ]),
    navigation,
    feedback,
    body,
  );
  root.append(dialog);
  function draw() {
    if (closed) return;
    const ctx = getContext(body);
    const focus = captureWorkspaceFocus(root, { body }, null),
      scroll = body.scrollTop;
    body.replaceChildren();
    body.dataset.workspaceTool = current;
    title.textContent = workspaceTools[current].title;
    description.textContent = workspaceTools[current].description;
    dialog.setAttribute('aria-label', workspaceTools[current].title);
    navigation.replaceChildren();
    for (const [id, tool] of Object.entries(workspaceTools))
      navigation.append(
        button(d, tool.title, () => switchTo(id), {
          icon: tool.icon,
          'data-tool-tab': id,
          'aria-pressed': id === current,
        }),
      );
    const toolKey = current;
    const toolCtx = {
      ...ctx,
      state: state[current],
      isActive: () => !closed && current === toolKey,
      refresh: () => {
        if (current === toolKey) update(true);
      },
    };
    if (current === 'brand') {
      const controls = el(d, 'section', {
        class: 'branding-controls',
        'aria-label': 'Branding controls',
      });
      const preview = el(d, 'section', {
        class: 'branding-preview',
        'aria-label': 'Current website preview',
      });
      body.append(el(d, 'div', { class: 'branding-workspace' }, [controls, preview]));
      rendered = workspaceTools[current].render({ ...toolCtx, panel: controls });
      const output = renderPage(ctx.history.document, ctx.data, { mode: 'review' });
      preview.append(
        el(d, 'h3', { text: 'Your website' }),
        el(d, 'p', {
          class: 'muted',
          text: 'Draft preview · changes save through your existing draft workflow.',
        }),
        el(d, 'iframe', {
          title: 'Branding preview',
          sandbox: '',
          tabindex: '-1',
          srcdoc: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';img-src http: https:;style-src 'unsafe-inline';font-src 'self' http: https:"><style>body{margin:0}*{pointer-events:none}</style></head><body>${output.html}</body></html>`,
        }),
      );
    } else rendered = workspaceTools[current].render(toolCtx);
    lastDocument = ctx.history.document;
    lastData = ctx.data;
    lastSelection = ctx.selectedId;
    restoreWorkspaceFocus(focus, { body });
    body.scrollTop = scroll;
  }
  function update(force = false) {
    if (closed) return;
    const ctx = getContext(body);
    if (
      force ||
      ctx.history.document !== lastDocument ||
      ctx.data !== lastData ||
      ctx.selectedId !== lastSelection
    )
      draw();
  }
  function switchTo(next) {
    if (closed || !workspaceTools[next]) return;
    current = next;
    feedback.hidden = true;
    draw();
    onSwitch();
    navigation.querySelector(`[data-tool-tab="${next}"]`)?.focus({ preventScroll: true });
  }
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  draw();
  if (dialog.showModal) dialog.showModal();
  else dialog.setAttribute('open', '');
  dismiss.focus();
  return {
    element: dialog,
    close,
    update,
    switchTo,
    report(text, isError = false) {
      if (closed) return;
      feedback.textContent = text;
      feedback.hidden = !text;
      feedback.classList.toggle('error', isError);
      feedback.setAttribute('role', isError ? 'alert' : 'status');
    },
    get key() {
      return current;
    },
    get ready() {
      return rendered?.ready || Promise.resolve();
    },
  };
}
