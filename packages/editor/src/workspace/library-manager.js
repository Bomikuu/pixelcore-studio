import { el, button, field, modal } from '../components/ui/index.js';
import { createTemplate } from '@sitebuilder/core';

export function openLibraryManager({ root, adapter, document, download, onChanged = () => {} }) {
  const d = root.ownerDocument;
  const body = el(d, 'div', { class: 'library-manager' });
  const status = el(d, 'p', { role: 'status' });
  const list = el(d, 'div', { class: 'library-management-list' });
  const detail = el(d, 'section', { 'aria-label': 'Saved design settings' });
  let kind = 'templates',
    archived = false,
    generation = 0,
    busy = false,
    offset = 0;
  body.append(
    field(
      d,
      'Library',
      kind,
      (v) => {
        kind = v;
        offset = 0;
        load();
      },
      { options: ['templates', 'sections'] },
    ),
    field(
      d,
      'Show',
      'active',
      (v) => {
        archived = v === 'archived';
        offset = 0;
        load();
      },
      { options: ['active', 'archived'] },
    ),
    status,
    list,
    detail,
  );
  const dialog = modal(root, 'Manage saved designs', body, () => {}, { confirmLabel: 'Done' });
  async function run(action) {
    if (busy) return;
    busy = true;
    try {
      await action();
      status.textContent = 'Library updated.';
      onChanged();
      await load();
    } catch (e) {
      status.textContent = e.message;
    } finally {
      ((busy = false), (offset = 0));
    }
  }
  async function load() {
    const token = ++generation;
    status.textContent = 'Loading designs…';
    list.replaceChildren();
    detail.replaceChildren();
    try {
      const page = adapter.listDesigns
        ? await adapter.listDesigns(kind, { offset, archived })
        : null;
      const items =
        page?.designs ||
        (await (kind === 'templates' ? adapter.listTemplates() : adapter.listSections()));
      if (token !== generation || !dialog.element.isConnected) return;
      const rows = items.filter((item) => Boolean(item.archived) === archived);
      status.textContent = rows.length
        ? `${rows.length} saved ${kind}.`
        : `No ${archived ? 'archived' : 'active'} ${kind}.`;
      for (const item of rows)
        list.append(
          button(
            d,
            `${item.name} · v${item.version || 1}${item.tags?.length ? ' · ' + item.tags.join(', ') : ''}`,
            () => edit(item),
          ),
        );
      if (page?.nextOffset != null)
        list.append(
          button(d, 'More designs', () => {
            offset = page.nextOffset;
            load();
          }),
        );
      if (offset)
        list.append(
          button(d, 'Previous designs', () => {
            offset = Math.max(0, offset - 25);
            load();
          }),
        );
    } catch (e) {
      if (token === generation) status.textContent = e.message;
    }
  }
  async function edit(summary) {
    const token = ++generation;
    detail.replaceChildren();
    status.textContent = 'Loading design…';
    try {
      const item = await adapter.readDesign(kind, summary.id);
      if (token !== generation || !dialog.element.isConnected) return;
      status.textContent = '';
      let name = item.name,
        description = item.description || '',
        tags = (item.tags || []).join(', ');
      const update = (value) =>
        adapter.updateDesign(kind, item.id, { expectedVersion: item.version, ...value });
      detail.append(
        el(d, 'h3', { text: item.name }),
        field(d, 'Name', name, (v) => (name = v)),
        field(d, 'Tags (comma separated)', tags, (v) => (tags = v)),
      );
      if (kind === 'templates')
        detail.append(
          field(d, 'Description', description, (v) => (description = v), { type: 'textarea' }),
        );
      detail.append(
        button(d, 'Save details', () =>
          run(() =>
            update({
              name,
              description,
              tags: tags
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean),
            }),
          ),
        ),
        button(d, item.archived ? 'Restore to library' : 'Archive design', () =>
          run(() => update({ archived: !item.archived })),
        ),
      );
      if (kind === 'templates') {
        detail.append(
          button(d, 'Save current page as next version', () => run(() => update({ document }))),
        );
        for (const revision of item.revisions || []) {
          const row = el(d, 'div', { class: 'library-version' }, [
            el(d, 'span', { text: `Version ${revision.number} · ${revision.name}` }),
          ]);
          row.append(
            button(d, 'Export version', () =>
              run(async () =>
                download(
                  'website-template.json',
                  createTemplate(await adapter.readTemplateVersion(item.id, revision.number)),
                ),
              ),
            ),
          );
          if (revision.number !== item.version)
            row.append(
              button(d, 'Restore version', () =>
                run(() => update({ restoreVersion: revision.number })),
              ),
            );
          detail.append(row);
        }
      }
      // Deletion confirmation is inline, keeping focus within this one dialog.
      detail.append(
        button(d, 'Delete saved design…', () => {
          detail.append(
            el(d, 'p', {
              text: 'Permanently delete this library copy and its versions? Existing pages and their revisions remain available.',
            }),
            button(
              d,
              'Delete permanently',
              () => run(() => adapter.deleteDesign(kind, item.id, item.version)),
              { class: 'ui-button danger' },
            ),
          );
        }),
      );
    } catch (e) {
      status.textContent = e.message;
    }
  }
  load();
  return dialog;
}
