import { normalizeGlobalFonts, walk } from '@sitebuilder/core';
import { renderPage } from '@sitebuilder/renderer';
import { button, el } from '../components/ui/index.js';

/** onRestore owns flushing local edits, optimistic restoration and editor replacement. */
export function openRevisionHistory({
  root,
  adapter,
  currentVersion,
  document,
  data = {},
  onRestore,
  onError,
}) {
  const d = root.ownerDocument,
    previous = root.activeElement;
  const dialog = el(d, 'dialog', {
    class: 'library-dialog revision-history',
    'aria-label': 'Revision history',
  });
  const list = el(d, 'nav', { class: 'library-filters', 'aria-label': 'Saved revisions' });
  const detail = el(d, 'div', { class: 'library-content' });
  const error = el(d, 'p', { class: 'error', role: 'alert' });
  const status = el(d, 'p', { class: 'muted', role: 'status' });
  let closed = false,
    pending = false,
    requestId = 0,
    revisions = [];
  const close = () => {
    if (closed) return;
    closed = true;
    requestId++;
    dialog.close?.();
    dialog.remove();
    previous?.focus?.();
  };
  const fail = (cause) => {
    if (closed) return;
    error.textContent = cause?.message || 'This revision could not be loaded. Try again.';
    onError?.(cause);
  };
  const heading = el(d, 'div', { class: 'library-heading' }, [
    el(d, 'div', {}, [
      el(d, 'h2', { text: 'Revision history' }),
      el(d, 'p', {
        class: 'muted',
        text: 'Inspect saved designs and restore a previous revision as a new draft. Your live website stays unchanged. Preview data comes from the currently connected public records.',
      }),
    ]),
    button(d, 'Close history', close),
  ]);
  const body = el(d, 'div', { class: 'library-body' }, [list, detail]);
  dialog.append(heading, body);

  function preview(page, label) {
    const out = renderPage(normalizeGlobalFonts(page), data, { mode: 'review' });
    return el(d, 'iframe', {
      title: `${label} preview`,
      sandbox: '',
      class: 'library-preview detail-preview',
      style: 'transform:none;width:100%;height:380px;pointer-events:none',
      srcdoc: `<!doctype html><html><head><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';img-src https: http:;style-src 'unsafe-inline';font-src 'self' https: http:"><style>body{margin:0}*{pointer-events:none}</style></head><body>${out.html}</body></html>`,
    });
  }
  function renderCurrent() {
    detail.replaceChildren(el(d, 'h3', { text: 'Current draft' }), status, error);
    status.textContent = 'This includes your current unsaved edits.';
    try {
      detail.append(preview(document, 'Current draft'));
    } catch (cause) {
      fail(cause);
    }
  }
  function changes(current, live) {
    const canonical = (value) =>
      JSON.stringify(value, (_key, item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
          : item,
      );
    const index = (page) => {
      const result = new Map();
      walk(page, (item) =>
        result.set(
          item.id,
          canonical({
            type: item.type,
            props: item.props,
            style: item.style || {},
            responsive: item.responsive || {},
            children: item.children.map((child) => child.id),
            ...(item.type === 'page'
              ? { title: item.title, mode: item.mode, motionDisabled: item.motionDisabled }
              : {}),
          }),
        ),
      );
      return result;
    };
    const before = index(live),
      after = index(current);
    let added = 0,
      removed = 0,
      changed = 0;
    for (const [id, value] of after) {
      if (!before.has(id)) added++;
      else if (before.get(id) !== value) changed++;
    }
    for (const id of before.keys()) if (!after.has(id)) removed++;
    return `${added} added · ${removed} removed · ${changed} changed elements · ${canonical(current.theme) === canonical(live.theme) ? 'Theme unchanged' : 'Theme changed'}`;
  }
  async function compare() {
    if (closed || pending) return;
    const published = revisions.find((revision) => revision.isPublished);
    if (!published) return;
    const token = ++requestId;
    detail.replaceChildren(el(d, 'h3', { text: 'Compare draft with live' }), status, error);
    status.textContent = 'Loading the live layout…';
    error.textContent = '';
    for (const item of list.querySelectorAll('[data-revision]'))
      item.setAttribute('aria-pressed', 'false');
    try {
      const loaded = await adapter.readRevision(published.id);
      if (closed || token !== requestId) return;
      const live = normalizeGlobalFonts(loaded.document);
      const current = normalizeGlobalFonts(document);
      const liveFrame = preview(live, 'Live layout');
      const draftFrame = preview(current, 'Current draft');
      status.textContent = changes(current, live);
      const columns = el(d, 'div', {
        class: 'revision-comparison',
        style: 'display:flex;flex-wrap:wrap;gap:24px;min-width:0',
      });
      for (const [label, frame] of [
        ['Live layout', liveFrame],
        ['Current draft', draftFrame],
      ])
        columns.append(
          el(d, 'section', { style: 'flex:1 1 360px;min-width:0' }, [
            el(d, 'h4', { text: label }),
            frame,
          ]),
        );
      detail.append(
        el(d, 'p', {
          class: 'muted',
          text: 'Both previews use the same current public data. This compares layouts, content and theme settings; it does not compare past system records or publish changes.',
        }),
        columns,
      );
    } catch (cause) {
      if (closed || token !== requestId) return;
      status.textContent = '';
      fail(cause);
      detail.append(button(d, 'Retry comparison', compare));
    }
  }
  async function choose(meta) {
    if (closed || pending) return;
    const token = ++requestId;
    detail.replaceChildren(el(d, 'h3', { text: `Revision ${meta.number ?? ''}` }), status, error);
    status.textContent = 'Loading revision…';
    error.textContent = '';
    for (const item of list.querySelectorAll('[data-revision]'))
      item.setAttribute(
        'aria-pressed',
        String(item.getAttribute('data-revision') === String(meta.id)),
      );
    try {
      const loaded = await adapter.readRevision(meta.id);
      if (closed || token !== requestId) return;
      const revision = {
        ...meta,
        ...loaded,
        id: meta.id,
        document: normalizeGlobalFonts(loaded.document),
      };
      const frame = preview(revision.document, `Revision ${meta.number ?? ''}`);
      const date = new Date(meta.createdAt);
      status.textContent = `${Number.isNaN(date.valueOf()) ? 'Saved revision' : date.toLocaleString()}${meta.isDraft ? ' · Current saved draft' : ''}${meta.isPublished ? ' · Live' : ''}`;
      detail.append(frame);
      const actions = el(d, 'div', { class: 'dialog-actions' });
      const restore = button(
        d,
        'Restore as draft',
        () => {
          if (pending || closed) return;
          actions.replaceChildren(
            el(d, 'p', {
              text: 'Restore this revision as a new draft? The current draft will remain in saved history.',
            }),
            button(d, 'Cancel restoration', () => {
              if (!pending) {
                actions.replaceChildren(restore);
              }
            }),
            button(
              d,
              'Confirm restoration',
              async () => {
                if (pending || closed) return;
                pending = true;
                error.textContent = '';
                status.textContent = 'Restoring draft…';
                const controls = [...dialog.querySelectorAll('button')].map((control) => [
                  control,
                  control.disabled,
                ]);
                for (const [control] of controls)
                  if (control.textContent !== 'Close history') control.disabled = true;
                try {
                  if (onRestore) await onRestore(revision);
                  else if (adapter.restoreRevision)
                    await adapter.restoreRevision(revision.id, currentVersion);
                  else throw new Error('This connection does not support restoring revisions.');
                  if (!closed) close();
                } catch (cause) {
                  fail(cause);
                  if (!closed)
                    status.textContent =
                      'Restoration did not complete. Your live website stays unchanged.';
                } finally {
                  pending = false;
                  if (!closed)
                    for (const [control, wasDisabled] of controls) control.disabled = wasDisabled;
                }
              },
              { class: 'ui-button primary' },
            ),
          );
          actions.querySelector('button')?.focus();
        },
        { class: 'ui-button primary' },
      );
      if (onRestore || adapter.restoreRevision) actions.append(restore);
      detail.append(actions);
    } catch (cause) {
      if (closed || token !== requestId) return;
      status.textContent = '';
      fail(cause);
      detail.append(button(d, 'Retry revision', () => choose(meta)));
    }
  }
  async function load() {
    const token = ++requestId;
    list.replaceChildren(el(d, 'p', { class: 'muted', text: 'Loading saved revisions…' }));
    error.textContent = '';
    try {
      const values = await adapter.listRevisions();
      if (closed || token !== requestId) return;
      if (!Array.isArray(values))
        throw new Error('The saved revision list was invalid. Try again.');
      revisions = values;
      list.replaceChildren(
        button(d, 'Current draft', () => {
          if (!pending) {
            requestId++;
            renderCurrent();
          }
        }),
      );
      const published = revisions.some((revision) => revision.isPublished);
      list.append(button(d, 'Compare draft with live', compare, { disabled: !published }));
      if (!published)
        list.append(
          el(d, 'p', {
            class: 'muted',
            text: 'Publish this page to compare its live layout with the current draft.',
          }),
        );
      if (!revisions.length)
        list.append(
          el(d, 'p', {
            class: 'muted',
            text: 'No saved revisions yet. Save this draft to start its history.',
          }),
        );
      for (const revision of revisions) {
        const row = button(d, `Revision ${revision.number ?? ''}`, () => choose(revision), {
          'data-revision': revision.id,
          'aria-pressed': 'false',
        });
        if (revision.isDraft) row.append(el(d, 'span', { class: 'badge', text: 'Draft' }));
        if (revision.isPublished) row.append(el(d, 'span', { class: 'badge', text: 'Live' }));
        list.append(row);
      }
    } catch (cause) {
      if (closed || token !== requestId) return;
      list.replaceChildren(button(d, 'Retry history', load));
      fail(cause);
    }
  }
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  root.append(dialog);
  renderCurrent();
  if (dialog.showModal) dialog.showModal();
  else dialog.setAttribute('open', '');
  heading.querySelector('button')?.focus();
  return { close, element: dialog, ready: load() };
}
