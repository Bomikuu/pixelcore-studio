import { el, button, field, modal } from '../components/ui/index.js';
import {
  cloneNode,
  createDocument,
  findNode,
  findParent,
  node,
  validateDocument,
  walk,
} from '@sitebuilder/core';

const requests = new WeakMap();
function localSection(value) {
  if (!value || value.type !== 'section')
    throw new Error('A shared section must contain one section.');
  walk(value, (child) => {
    if (child.type === 'global-section')
      throw new Error(
        'Shared sections cannot contain linked sections. Detach the nested link first.',
      );
  });
  return value;
}
export function createGlobalReference(section) {
  if (!section?.id) throw new Error('The shared section is unavailable.');
  return node('global-section', { sectionId: section.id, name: section.name || 'Shared section' }, [
    cloneNode(localSection(section.node)),
  ]);
}
const notice = (d, text, role) => el(d, 'p', { class: 'muted', text, ...(role ? { role } : {}) });
const selectedNode = (ctx) => findNode(ctx.history.document, ctx.selectedId);
const affectedNames = (section) =>
  (section.affectedPages || []).map((page) => page.title || page.key || page.id);
async function changed(ctx, section) {
  await ctx.onGlobalsChanged?.(section);
}
function confirmAction(ctx, title, content, action, options) {
  let dialog,
    pending = false;
  dialog = modal(
    ctx.root,
    title,
    content,
    async () => {
      if (pending) throw new Error('This action is already saving.');
      pending = true;
      content.setAttribute('inert', '');
      dialog.element.setAttribute('aria-busy', 'true');
      const buttons = [...dialog.element.querySelectorAll('.dialog-actions > button')];
      buttons.forEach((control) => {
        control.disabled = true;
      });
      try {
        await action();
      } finally {
        pending = false;
        content.removeAttribute('inert');
        dialog.element.removeAttribute('aria-busy');
        buttons.forEach((control) => {
          control.disabled = false;
        });
      }
    },
    options,
  );
  dialog.element.addEventListener(
    'cancel',
    (event) => {
      if (pending) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    { capture: true },
  );
  return dialog;
}
function createSelected(ctx) {
  const selected = selectedNode(ctx);
  if (selected?.type !== 'section') return;
  let name = selected.props.name || 'Shared section';
  const content = el(ctx.d, 'div', {}, [
    notice(
      ctx.d,
      'Save a reusable source, then link it to pages. The selected section remains an independent local copy.',
    ),
    field(ctx.d, 'Section name', name, (value) => {
      name = value;
    }),
  ]);
  confirmAction(
    ctx,
    'Create shared section',
    content,
    async () => {
      if (!name.trim() || name.trim().length > 100)
        throw new Error('Enter a section name of 1–100 characters.');
      const section = await ctx.adapter.createGlobalSection(
        name.trim(),
        cloneNode(localSection(selected)),
      );
      await changed(ctx, section);
      ctx.report?.('Shared section created. Link it to a page when ready.', false);
      renderGlobalSections(ctx);
    },
    { confirmLabel: 'Create shared section' },
  );
}
function publishSection(ctx, section) {
  const names = affectedNames(section);
  const content = el(ctx.d, 'div', {}, [
    notice(
      ctx.d,
      'This publishes the shared section across linked live pages. It does not publish any page drafts.',
    ),
    el(ctx.d, 'p', {
      text: names.length
        ? `${names.length} linked page${names.length === 1 ? '' : 's'} may change:`
        : 'No pages are linked yet. Future linked pages will use this published version.',
    }),
  ]);
  if (names.length)
    content.append(
      el(
        ctx.d,
        'ul',
        {},
        names.map((name) => el(ctx.d, 'li', { text: name })),
      ),
    );
  confirmAction(
    ctx,
    `Publish ${section.name}?`,
    content,
    async () => {
      const updated = await ctx.adapter.publishGlobalSection(section.id, section.version);
      await changed(ctx, updated);
      ctx.report?.('Shared section published. Page drafts were not published.', false);
      renderGlobalSections(ctx);
    },
    { confirmLabel: 'Publish shared section' },
  );
}
async function detachSelected(ctx) {
  const linked = selectedNode(ctx);
  if (linked?.type !== 'global-section') return;
  const cached = ctx.data?.globalSections?.[linked.props.sectionId];
  let source = cached;
  if (ctx.adapter.readGlobalSection) {
    try {
      source = await ctx.adapter.readGlobalSection(linked.props.sectionId);
    } catch (error) {
      return confirmAction(
        ctx,
        'Detach the saved copy?',
        el(ctx.d, 'p', {
          text: 'The shared source is unavailable. Use the section copy saved in this page as an independent, editable section?',
        }),
        () => replaceLinkedCopy(ctx, linked, cached?.node || linked.children[0]),
        { confirmLabel: 'Use saved copy' },
      );
    }
  }
  const sourceNode =
    source?.node || (source?.type === 'section' ? source : null) || linked.children[0];
  replaceLinkedCopy(ctx, linked, sourceNode);
}
function replaceLinkedCopy(ctx, linked, sourceNode) {
  const document = structuredClone(ctx.history.document);
  const parent = findParent(document, linked.id);
  if (!parent) throw new Error('Select a linked section inside this page.');
  const index = parent.children.findIndex((child) => child.id === linked.id);
  parent.children[index] = cloneNode(localSection(sourceNode));
  if (ctx.command({ type: 'restore', document }) === false)
    throw new Error('The local copy could not be inserted.');
  ctx.report?.('Detached as an editable local copy. Undo restores the link.', false);
  renderGlobalSections(ctx);
}

export async function openGlobalSectionEditor(ctx, initial) {
  const section = ctx.adapter.readGlobalSection
    ? await ctx.adapter.readGlobalSection(initial.id)
    : initial;
  if (ctx.isActive?.() === false) return;
  const { d, root } = ctx;
  const document = createDocument({ title: `Shared: ${section.name}` });
  document.theme = structuredClone(ctx.history.document.theme);
  document.children = [cloneNode(localSection(section.node))];
  validateDocument(document);
  let current = structuredClone(document),
    name = section.name,
    dirty = false,
    editor,
    closed = false,
    dialog,
    localVersion = 0;
  const content = el(d, 'div', {}, [
    notice(
      d,
      'You are editing this shared section in isolation. Save creates a shared draft; publishing is a separate action.',
    ),
    field(d, 'Shared section name', name, (value) => {
      name = value;
      dirty = true;
    }),
  ]);
  const editorHost = el(d, 'div', {
    class: 'shared-section-editor',
    style: 'height:min(68vh,760px);min-height:400px',
  });
  const loading = notice(d, 'Opening section editor…', 'status');
  content.append(loading, editorHost);
  const cleanup = () => {
    closed = true;
    editor?.destroy?.();
  };
  dialog = confirmAction(
    ctx,
    `Edit ${section.name}`,
    content,
    async () => {
      if (!editor) throw new Error('The section editor is still loading.');
      if (!name.trim() || name.trim().length > 100)
        throw new Error('Enter a section name of 1–100 characters.');
      current = editor.getDocument();
      validateDocument(current);
      if (current.children.length !== 1)
        throw new Error('Keep exactly one section in this shared design.');
      const value = cloneNode(localSection(current.children[0]));
      const updated = await ctx.adapter.saveGlobalSection(section.id, {
        name: name.trim(),
        node: value,
        expectedVersion: section.version,
      });
      dirty = false;
      await changed(ctx, updated);
      cleanup();
      ctx.report?.('Shared draft saved. Publish it separately to update live pages.', false);
      renderGlobalSections(ctx);
    },
    { confirmLabel: 'Save shared draft' },
  );
  dialog.element.style.width = 'min(1480px,96vw)';
  dialog.element.style.maxWidth = '96vw';
  const close = () => {
    cleanup();
    dialog.close();
  };
  const requestClose = () => {
    if (!dirty) {
      close();
      return;
    }
    confirmAction(
      ctx,
      'Discard shared section edits?',
      notice(
        d,
        'Your unsaved section edits will be discarded. The saved shared draft stays unchanged.',
      ),
      close,
      { confirmLabel: 'Discard edits', danger: true },
    );
  };
  const cancel = dialog.element.querySelector('.dialog-actions > button');
  cancel.replaceWith(button(d, 'Close', requestClose));
  dialog.element.addEventListener(
    'cancel',
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      requestClose();
    },
    { capture: true },
  );
  try {
    const mount = ctx.mountSectionEditor || (await import('../index.js')).mountEditor;
    if (closed) return { close };
    const { frame, globalSections, ...publicData } = ctx.data || {};
    editor = mount(editorHost, {
      document,
      data: publicData,
      version: 0,
      adapter: {
        capabilities: ctx.adapter.capabilities || [],
        sources: ctx.adapter.sources || [],
        dataSources: ctx.adapter.dataSources || [],
        workspace: { kind: 'global-section', sourceName: section.name },
        saveDraft: async (value) => {
          current = structuredClone(value);
          return { version: ++localVersion };
        },
      },
      onChange: (value) => {
        current = value;
        dirty = true;
      },
    });
    loading.remove();
  } catch (error) {
    loading.textContent = `Could not open the section editor. ${error.message}`;
    loading.setAttribute('role', 'alert');
  }
  return { close: requestClose, element: dialog.element };
}

export function renderGlobalSections(ctx) {
  const { d, panel, adapter = {}, report = () => {} } = ctx;
  const request = {};
  requests.set(panel, request);
  panel.replaceChildren(
    el(d, 'h2', { class: 'panel-heading', text: 'Shared sections' }),
    notice(d, 'Link one design across pages. Shared drafts and live pages publish separately.'),
  );
  const selected = selectedNode(ctx);
  panel.append(
    button(d, 'Create from selected section', () => createSelected(ctx), {
      disabled: selected?.type !== 'section' || !adapter.createGlobalSection,
    }),
  );
  if (selected?.type === 'global-section')
    panel.append(
      button(d, 'Detach selected link', async () => {
        try {
          await detachSelected(ctx);
        } catch (error) {
          report(error.message);
        }
      }),
    );
  if (!adapter.listGlobalSections) {
    panel.append(notice(d, 'Shared sections are not available in this host.', 'status'));
    return { ready: Promise.resolve() };
  }
  const status = notice(d, 'Loading shared sections…', 'status');
  panel.append(status);
  const ready = (async () => {
    try {
      const sections = await adapter.listGlobalSections();
      if (requests.get(panel) !== request || !panel.contains(status)) return;
      status.remove();
      if (!sections.length)
        panel.append(
          notice(d, 'No shared sections yet. Select a section in Layers to create one.', 'status'),
        );
      for (const section of sections) {
        const row = el(d, 'section', { class: 'inspector-section' }, [
          el(d, 'h3', { text: section.name }),
          notice(
            d,
            `Draft v${section.draftVersion} · ${section.publishedVersion == null ? 'Not published' : `Live v${section.publishedVersion}`}`,
          ),
          notice(d, `${(section.affectedPages || []).length} linked pages`),
        ]);
        row.append(
          button(
            d,
            `Link ${section.name}`,
            () => {
              try {
                ctx.insertNode?.(createGlobalReference(section));
              } catch (error) {
                report(error.message);
              }
            },
            { disabled: !ctx.insertNode },
          ),
        );
        row.append(
          button(
            d,
            `Edit ${section.name}`,
            async () => {
              try {
                await openGlobalSectionEditor(ctx, section);
              } catch (error) {
                report(error.message);
              }
            },
            { disabled: !adapter.saveGlobalSection },
          ),
        );
        row.append(
          button(d, `Publish ${section.name}`, () => publishSection(ctx, section), {
            disabled:
              !adapter.publishGlobalSection || section.draftVersion === section.publishedVersion,
          }),
        );
        panel.append(row);
      }
    } catch (error) {
      if (requests.get(panel) !== request || !panel.contains(status)) return;
      status.textContent = `Could not load shared sections. ${error.message}`;
      status.setAttribute('role', 'alert');
      panel.append(button(d, 'Retry loading shared sections', () => renderGlobalSections(ctx)));
    }
  })();
  return { ready };
}
