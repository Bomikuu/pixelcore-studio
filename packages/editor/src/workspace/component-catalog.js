import { el, button } from '../components/ui/index.js';
import { cloneNode, node, validateDocument, createDocument } from '@sitebuilder/core';

export async function loadCatalog(url) {
  const { createCatalogClient } = await import('@sitebuilder/components');
  return createCatalogClient(url);
}
export function openComponentCatalog(ctx, url, onDescriptor) {
  const { d, root } = ctx;
  const previous = root.activeElement;
  const dialog = el(d, 'dialog', {
    class: 'ui-dialog component-catalog-dialog',
    'aria-label': 'Component catalog',
  });
  const list = el(d, 'div', { class: 'component-catalog-list' }),
    status = el(d, 'p', { class: 'muted', role: 'status', text: 'Loading approved components…' });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    dialog.close?.();
    dialog.remove();
    if (previous?.isConnected) previous.focus();
  };
  dialog.append(
    el(d, 'h2', { text: 'Component catalog' }),
    el(d, 'p', {
      class: 'muted',
      text: 'Approved imports from your Studio. Interactive components keep their declared settings and pinned version.',
    }),
    list,
    status,
    button(d, 'Close', close),
  );
  root.append(dialog);
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dialog.showModal?.();
  if (!dialog.open) dialog.setAttribute('open', '');
  dialog.querySelector('button').focus();
  const load = async () => {
    try {
      const client = await loadCatalog(url),
        items = await client.list();
      if (closed || !dialog.isConnected) return;
      status.textContent = items.length
        ? 'Choose a component to add it to this page.'
        : 'No approved components yet. Import and approve a component in standalone Studio first.';
      for (let item of items) {
        const card = button(
          d,
          item.name,
          async () => {
            if (closed) return;
            try {
              if (item.native === true) item = await client.get(item.id, item.version);
              if (closed || !dialog.isConnected) return;
              let added;
              if (item.native) {
                validateDocument(item.native);
                const children = item.native.children.map(cloneNode);
                if (!children.length) throw new Error('This native component is empty.');
                added =
                  children.length === 1
                    ? children[0]
                    : node('container', { name: item.name }, children);
              } else {
                added = node('component', {
                  name: item.name,
                  componentId: item.id,
                  componentVersion: item.version,
                  componentSettings: JSON.stringify(
                    Object.fromEntries(item.manifest.fields.map((f) => [f.key, f.default])),
                  ),
                  fallbackText: item.manifest.fallbackText || item.name,
                });
                added.style.height = item.manifest.height;
              }
              const check = createDocument();
              check.children = [added];
              validateDocument(check);
              onDescriptor(item);
              close();
              ctx.insertNode(added);
              ctx.report(`${item.name} added.`, false);
            } catch (error) {
              status.textContent = error.message;
              status.className = 'error';
            }
          },
          { class: 'ui-button component-catalog-card', 'aria-label': `Add ${item.name}` },
        );
        if (item.posterUrl)
          card.prepend(el(d, 'img', { src: item.posterUrl, alt: '', loading: 'lazy' }));
        card.append(
          el(d, 'span', {
            class: 'muted',
            text: `${item.native ? 'Native section' : item.manifest.kind} · v${item.version}`,
          }),
        );
        list.append(card);
      }
    } catch (error) {
      if (!closed) {
        status.textContent = error.message;
        status.className = 'error';
        list.append(
          button(d, 'Try again', () => {
            close();
            openComponentCatalog(ctx, url, onDescriptor);
          }),
        );
      }
    }
  };
  load();
  return {
    close,
    get isOpen() {
      return !closed;
    },
  };
}
