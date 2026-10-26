import { el, button, field, modal } from '../components/ui/index.js';
export function openReviewCenter({ root, adapter, create, onJump }) {
  const d = root.ownerDocument;
  const body = el(d, 'div', { class: 'review-center' }),
    status = el(d, 'p', { role: 'status' }),
    links = el(d, 'div', { class: 'review-link-list' }),
    detail = el(d, 'section', { 'aria-label': 'Review details' });
  const access = field(d, 'Reviewer access', 'comments', () => {}, {
      options: [
        { value: 'comments', label: 'View and comment' },
        { value: 'view', label: 'View only' },
      ],
    }),
    lifetime = field(d, 'Link expires in days', 7, () => {}, { type: 'number', min: 1, max: 30 });
  let generation = 0,
    offset = 0,
    busy = false,
    current,
    threadFilter = 'open';
  const result = el(d, 'div', { class: 'review-new-link' });
  const dialog = modal(root, 'Review center', body, () => {}, { confirmLabel: 'Done' });
  dialog.element.classList.add('review-center-dialog');
  const alive = () => dialog.element.isConnected;
  async function run(action) {
    if (busy) return;
    busy = true;
    const controls = [...body.querySelectorAll('button,input,select')].map((c) => [c, c.disabled]);
    controls.forEach(([c]) => (c.disabled = true));
    try {
      await action();
    } catch (e) {
      if (alive()) {
        status.textContent = e.message;
        status.setAttribute('role', 'alert');
      }
    } finally {
      busy = false;
      if (alive()) controls.forEach(([c, disabled]) => (c.disabled = disabled));
    }
  }
  const createButton = button(
    d,
    'Create review link',
    () =>
      run(async () => {
        const days = Number(lifetime.querySelector('input').value);
        if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('Choose 1–30 days.');
        const value = await create({
          canComment: access.querySelector('select').value === 'comments',
          lifetimeDays: days,
        });
        if (!alive()) return;
        result.replaceChildren(
          el(d, 'p', {
            text: 'This saved revision is ready to share. Keep this private link; its secret is shown only when created.',
          }),
          el(d, 'a', {
            href: value.url,
            text: value.url,
            target: '_blank',
            rel: 'noopener noreferrer',
            class: 'review-link',
          }),
          button(
            d,
            'Copy link',
            () =>
              run(async () => {
                if (!d.defaultView.navigator.clipboard?.writeText)
                  throw new Error('Clipboard unavailable. Select and copy the link above.');
                await d.defaultView.navigator.clipboard.writeText(value.url);
                status.textContent = 'Link copied.';
              }),
            { icon: 'share' },
          ),
        );
        await load();
      }),
    { icon: 'share' },
  );
  body.append(
    el(d, 'p', {
      class: 'muted',
      text: 'Links preserve a saved revision. Guest names are unverified, and review links cannot submit RSVP or other system actions.',
    }),
    el(d, 'div', { class: 'review-create-controls' }, [access, lifetime, createButton]),
    result,
    status,
    el(d, 'div', { class: 'review-management' }, [links, detail]),
  );
  async function load() {
    const token = ++generation;
    status.setAttribute('role', 'status');
    status.textContent = 'Loading review links…';
    try {
      const page = await adapter.listReviews(offset);
      if (!alive() || token !== generation) return;
      links.replaceChildren();
      for (const row of page.reviews)
        links.append(
          button(
            d,
            `Revision ${row.revision} · ${row.revoked ? 'Revoked' : row.active ? 'Active' : 'Expired'} · ${row.openCount} open`,
            () => read(row.id),
            { 'data-review-id': row.id },
          ),
        );
      if (!page.reviews.length) links.append(el(d, 'p', { text: 'No review links yet.' }));
      if (offset)
        links.append(
          button(d, 'Previous links', () => {
            offset = Math.max(0, offset - 25);
            load();
          }),
        );
      if (page.nextOffset !== null)
        links.append(
          button(d, 'More links', () => {
            offset = page.nextOffset;
            load();
          }),
        );
      status.textContent = 'Review links loaded.';
    } catch (e) {
      if (alive() && token === generation) {
        status.textContent = e.message;
        status.setAttribute('role', 'alert');
        links.replaceChildren(button(d, 'Retry loading links', load));
      }
    }
  }
  async function read(id) {
    const token = ++generation;
    status.textContent = 'Loading discussion…';
    try {
      const value = await adapter.readReview(id);
      if (!alive() || token !== generation) return;
      current = value;
      drawDetail();
      status.textContent = 'Discussion loaded.';
    } catch (e) {
      if (alive() && token === generation) {
        status.textContent = e.message;
        status.setAttribute('role', 'alert');
      }
    }
  }
  function drawDetail() {
    detail.replaceChildren(
      el(d, 'h3', { text: `Saved revision ${current.revision}` }),
      el(d, 'p', {
        class: 'muted',
        text: `${current.revoked ? 'Revoked · ' : ''}Expires ${new Date(current.expiresAt).toLocaleString()}`,
      }),
    );
    if (!current.revoked) {
      const mode = field(d, 'Link access', current.canComment ? 'comments' : 'view', () => {}, {
        options: [
          { value: 'comments', label: 'View and comment' },
          { value: 'view', label: 'View only' },
        ],
      });
      const days = field(d, 'Renew for days', 7, () => {}, { type: 'number', min: 1, max: 30 });
      detail.append(
        mode,
        days,
        button(d, 'Save link settings', () =>
          run(async () => {
            current = await adapter.updateReview(current.id, {
              expectedExpiresAt: current.expiresAt,
              canComment: mode.querySelector('select').value === 'comments',
              lifetimeDays: Number(days.querySelector('input').value),
            });
            if (alive()) {
              drawDetail();
              await load();
            }
          }),
        ),
        button(
          d,
          'Revoke link',
          () =>
            run(async () => {
              await adapter.revokeReview(current.id);
              if (alive()) {
                await read(current.id);
                await load();
              }
            }),
          { class: 'ui-button danger' },
        ),
      );
    }
    const filter = field(
      d,
      'Discussion filter',
      threadFilter,
      (value) => {
        threadFilter = value;
        drawDetail();
      },
      {
        options: [
          { value: 'open', label: 'Open threads' },
          { value: 'resolved', label: 'Resolved threads' },
          { value: 'all', label: 'All threads' },
        ],
      },
    );
    detail.append(filter);
    const threads = current.threads.filter(
      (t) => threadFilter === 'all' || (threadFilter === 'resolved') === t.resolved,
    );
    if (!threads.length) detail.append(el(d, 'p', { text: 'No matching comments.' }));
    for (const thread of threads) {
      const section = el(d, 'section', { class: 'review-thread' }, [
        el(d, 'h4', {
          text: (thread.resolved ? 'Resolved' : 'Open') + ` · ${thread.viewport}px preview`,
        }),
      ]);
      for (const comment of thread.comments)
        section.append(
          el(d, 'strong', { text: comment.name }),
          el(d, 'p', { text: comment.body, class: 'comment-text' }),
        );
      section.append(
        button(d, 'Show element at reviewed width', () => {
          dialog.close();
          onJump(thread.nodeId, thread.viewport);
        }),
        button(d, thread.resolved ? 'Reopen thread' : 'Resolve thread', () =>
          run(async () => {
            await adapter.resolveReviewThread(current.id, thread.id, !thread.resolved);
            if (alive()) {
              await read(current.id);
              await load();
            }
          }),
        ),
      );
      detail.append(section);
    }
  }
  load();
  return dialog;
}
