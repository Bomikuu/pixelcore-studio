import { renderPage, fontCss } from '@sitebuilder/renderer';
import { createJsonClient } from '@sitebuilder/core';
import { el, button, field } from '@sitebuilder/editor/ui';
import { tokenCss, applyTokens, tokens } from '@sitebuilder/editor/tokens';
import { editorCss } from '@sitebuilder/editor/styles';
export function mountReview(element, options = {}) {
  const d = element.ownerDocument,
    w = d.defaultView,
    root = element.shadowRoot || element.attachShadow({ mode: 'open' });
  root.replaceChildren();
  let alive = true,
    snapshot = null,
    selected = null,
    replyId = null;
  const restoreTokens = applyTokens(element);
  const { send } = createJsonClient(options);
  const shell = el(d, 'div', { class: 'builder', style: tokenCss() }),
    status = el(d, 'p', { role: 'status', 'aria-live': 'polite', text: 'Opening saved preview…' });
  root.append(
    el(d, 'style', {
      text:
        fontCss +
        editorCss +
        `.review-workspace{display:grid;grid-template-columns:minmax(0,1fr) 320px;flex:1}.review-canvas{overflow:auto;background:var(--editor-background);padding:24px}.review-frame{border:0;width:100%;min-height:760px;background:var(--editor-surface)}.review-panel{background:var(--editor-surface);overflow:auto;max-height:calc(100vh - 80px)}.comment-text{white-space:pre-wrap;font-size:13px}.review-meta{font-size:12px;color:var(--editor-muted)}@media(max-width:800px){.review-workspace{grid-template-columns:1fr}.review-panel{max-height:none}}`,
    }),
    shell,
  );
  const top = el(d, 'header', { class: 'topbar' }, [
    el(d, 'div', { class: 'brand', text: 'Website review' }),
    status,
  ]);
  const body = el(d, 'div', { class: 'review-workspace' }),
    canvas = el(d, 'div', { class: 'review-canvas' }),
    panel = el(d, 'aside', { class: 'review-panel', 'aria-label': 'Preview comments' }),
    threads = el(d, 'div'),
    hint = el(d, 'p', {
      class: 'muted',
      text: 'Select an element on the page to leave a comment.',
    });
  const nameField = field(d, 'Your name', '', () => {});
  const bodyField = field(d, 'Comment', '', () => {}, { type: 'textarea' });
  const commentError = el(d, 'p', { class: 'error', role: 'alert' });
  const compose = el(d, 'section', {}, [
    el(d, 'h2', { class: 'panel-heading', text: 'Leave a comment' }),
    el(d, 'p', { class: 'muted', text: 'Names are entered by reviewers and are not verified.' }),
    hint,
    nameField,
    bodyField,
    commentError,
  ]);
  const submit = button(d, 'Post comment', async () => {
    if (!snapshot?.canComment || (!selected && !replyId)) return;
    submit.disabled = true;
    commentError.textContent = '';
    try {
      const result = await send(`reviews/${snapshot.id}/comments/`, {
        method: 'POST',
        body: {
          name: nameField.querySelector('input').value,
          body: bodyField.querySelector('textarea').value,
          ...(replyId ? { threadId: replyId } : { anchor: selected }),
        },
      });
      if (!alive) return;
      snapshot.threads = result.threads;
      bodyField.querySelector('textarea').value = '';
      replyId = null;
      selected = null;
      hint.textContent = 'Comment posted. Select another element to start a thread.';
      renderThreads();
      renderPins();
    } catch (e) {
      if (alive) commentError.textContent = e.message;
    } finally {
      if (alive) submit.disabled = false;
    }
  });
  compose.append(submit);
  panel.append(
    compose,
    el(d, 'h2', { class: 'panel-heading', text: 'Discussion', style: 'margin-top:28px' }),
    threads,
  );
  body.append(canvas, panel);
  shell.append(top, body);
  const frame = el(d, 'iframe', {
    class: 'review-frame',
    title: 'Saved website preview',
    sandbox: 'allow-same-origin',
    srcdoc: '<!doctype html><html><body></body></html>',
    referrerpolicy: 'no-referrer',
  });
  canvas.append(frame);
  function renderPins() {
    const fd = frame.contentDocument;
    if (!fd || !snapshot) return;
    for (const pin of fd.querySelectorAll('[data-review-pin]')) pin.remove();
    snapshot.threads.forEach((t, index) => {
      let target = [...fd.querySelectorAll('[data-wb-id]')].find(
        (n) => n.dataset.wbId === t.nodeId,
      );
      if (!target) return;
      const pin = button(
        fd,
        String(index + 1),
        (e) => {
          replyId = t.id;
          selected = null;
          hint.textContent = `Replying to thread ${index + 1}`;
          bodyField.querySelector('textarea').focus();
        },
        {
          'data-review-pin': t.id,
          'aria-label': `Open comment thread ${index + 1}`,
          style: `position:absolute;left:${t.x * 100}%;top:${t.y * 100}%;z-index:100;border:2px solid white;border-radius:50%;width:28px;height:28px;background:${t.resolved ? tokens.controlBorder : tokens.primary};color:white;cursor:pointer;font:600 12px Arial`,
        },
      );
      pin.addEventListener('click', (e) => e.stopPropagation());
      if (!target.style.position) target.style.position = 'relative';
      target.append(pin);
    });
  }
  function renderThreads() {
    threads.replaceChildren();
    if (!snapshot.threads.length)
      threads.append(
        el(d, 'p', {
          class: 'muted',
          text: 'No comments yet. Start the conversation on the page.',
        }),
      );
    snapshot.threads.forEach((t, index) => {
      const section = el(d, 'section', { class: 'thread', 'data-thread-id': t.id }, [
        el(d, 'h3', {
          text: `${index + 1}. ${t.resolved ? 'Resolved' : 'Open'}`,
          style: 'font-size:13px',
        }),
      ]);
      for (const c of t.comments)
        section.append(
          el(d, 'strong', { text: c.name, style: 'font-size:12px' }),
          el(d, 'p', { class: 'comment-text', text: c.body }),
        );
      if (snapshot.canComment)
        section.append(
          button(d, 'Reply', () => {
            replyId = t.id;
            selected = null;
            hint.textContent = `Replying to thread ${index + 1}`;
            bodyField.querySelector('textarea').focus();
          }),
        );
      if (snapshot.canResolve)
        section.append(
          button(d, t.resolved ? 'Reopen' : 'Resolve', async () => {
            try {
              const result = await send(`reviews/${snapshot.id}/threads/${t.id}/`, {
                method: 'POST',
                body: { resolved: !t.resolved },
              });
              if (alive) {
                snapshot.threads = result.threads;
                renderThreads();
                renderPins();
              }
            } catch (e) {
              commentError.textContent = e.message;
            }
          }),
        );
      threads.append(section);
    });
  }
  function renderCanvas() {
    if (!snapshot || !frame.contentDocument) return;
    const rendered = renderPage(snapshot.document, snapshot.data, { mode: 'review' }),
      fd = frame.contentDocument;
    fd.open();
    fd.write(
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';img-src https: http:;media-src 'none';style-src 'unsafe-inline';font-src 'self' http: https:"><style>body{margin:0}[data-wb-id]{cursor:crosshair}[data-review-selected]{outline:2px solid ${tokens.primary}!important}</style></head><body>${rendered.html}</body></html>`,
    );
    fd.close();
    fd.addEventListener('click', (e) => {
      e.preventDefault();
      if (e.target.closest?.('[data-review-pin]')) return;
      if (!snapshot.canComment) return;
      const target = e.target.closest?.('[data-wb-id]');
      if (!target) return;
      for (const n of fd.querySelectorAll('[data-review-selected]'))
        n.removeAttribute('data-review-selected');
      target.setAttribute('data-review-selected', '');
      const r = target.getBoundingClientRect();
      selected = {
        nodeId: target.dataset.wbId,
        field: target.dataset.wbField || '',
        x: Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(r.width, 1))),
        y: Math.max(0, Math.min(1, (e.clientY - r.top) / Math.max(r.height, 1))),
        viewport: Math.round(frame.clientWidth || 1100),
      };
      replyId = null;
      hint.textContent = `Commenting on ${target.dataset.wbType}.`;
      bodyField.querySelector('textarea').focus();
    });
    for (const n of fd.querySelectorAll('[data-wb-id]')) {
      n.tabIndex = 0;
      n.addEventListener('keydown', (e) => {
        if (e.target !== n || !['Enter', ' '].includes(e.key)) return;
        e.preventDefault();
        e.stopPropagation();
        n.click();
      });
    }
    frame.style.height = `${Math.max(760, fd.documentElement.scrollHeight || 0)}px`;
    renderPins();
  }
  const load = async () => {
    try {
      status.textContent = 'Opening saved preview…';
      let token = options.token;
      if (token === undefined) token = w.location.hash.slice(1);
      let reviewId = options.reviewId || new URL(w.location.href).searchParams.get('review');
      const result = token
        ? await send('reviews/exchange/', { method: 'POST', body: { token } })
        : reviewId
          ? await send(`reviews/${encodeURIComponent(reviewId)}/`)
          : null;
      if (!result) throw new Error('Open a valid review link.');
      if (!alive) return;
      snapshot = result;
      if (w.location.hash) {
        const url = new URL(w.location.href);
        url.hash = '';
        url.searchParams.set('review', snapshot.id);
        w.history.replaceState(null, '', url.href);
      }
      status.textContent = `Revision ${snapshot.revision} · Saved preview`;
      compose.hidden = !snapshot.canComment;
      renderThreads();
      renderCanvas();
      options.onReady?.(snapshot);
    } catch (e) {
      if (alive) {
        status.textContent = e.message;
        status.classList.add('error');
      }
    }
  };
  const refresh = button(d, 'Refresh comments', async () => {
    if (!snapshot) return;
    try {
      const r = await send(`reviews/${snapshot.id}/comments/`);
      if (alive) {
        snapshot.threads = r.threads;
        renderThreads();
        renderPins();
      }
    } catch (e) {
      status.textContent = e.message;
    }
  });
  top.append(refresh);
  frame.addEventListener('load', renderCanvas, { once: true });
  load();
  return {
    reload: load,
    destroy() {
      alive = false;
      root.replaceChildren();
      restoreTokens();
    },
  };
}
