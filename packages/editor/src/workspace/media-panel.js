import { el, button, field, filePicker } from '../components/ui/index.js';
import { icon } from '../components/ui/icons.js';
import {
  findNode,
  node,
  safeUrl,
  missingAssets,
  remapAsset,
  emptyMediaSlots,
} from '@sitebuilder/core';

export function renderMediaPanel(ctx) {
  const { d, panel, history, adapter, data, command, selectedId, select, onDataChanged } = ctx;
  const state = (ctx.state ||= {});
  state.search ??= '';
  state.kind ??= 'all';
  state.shown ??= 24;
  state.alt ??= '';
  const redraw = () => {
    if (!panel.isConnected || ctx.isActive?.() === false) return;
    if (ctx.refresh) ctx.refresh();
    else {
      panel.replaceChildren();
      renderMediaPanel(ctx);
    }
  };
  panel.append(el(d, 'h2', { class: 'panel-heading', text: 'Your media' }));
  const status = el(d, 'p', {
    class: state.error ? 'error' : 'muted',
    role: state.error ? 'alert' : 'status',
    text: state.error || state.status || '',
  });
  const toolbar = el(d, 'div', { class: 'media-toolbar' });
  const grid = el(d, 'div', { class: 'media-grid', 'aria-label': 'Project media' });
  const detail = el(d, 'section', { class: 'media-detail', 'aria-label': 'Media details' });
  const workspace = el(d, 'div', { class: 'media-workspace' }, [grid, detail]);
  const sources = () =>
    Object.entries(data.assets || {}).filter(([, a]) => safeUrl(a.url, { asset: true }));
  const selection = () => findNode(history.document, selectedId);
  const choose = (id, asset) => {
    const selected = selection(),
      type = asset.type === 'video' ? 'video' : 'image';
    if (selected?.type === type && typeof selected.props.assetId !== 'object') {
      if (
        command({
          type: 'props',
          id: selected.id,
          value: { assetId: id, alt: asset.alt || '' },
        }) !== false
      )
        select?.(selected.id);
    } else {
      const next = node(type, { assetId: id, alt: asset.alt || '' });
      if (command({ type: 'insert', id: history.document.id, node: next }) !== false)
        select?.(next.id);
    }
  };
  function drawDetail() {
    detail.replaceChildren();
    detail.hidden = !state.uploadOpen && !state.activeId;
    workspace.classList.toggle('has-detail', !detail.hidden);
    if (state.uploadOpen) {
      detail.append(
        el(d, 'h3', { text: 'Add media' }),
        el(d, 'p', { class: 'muted', text: 'JPEG, PNG or WebP · up to 8 MB and 20 megapixels.' }),
      );
      const picker = filePicker(
        d,
        'Image file',
        (file) => {
          state.file = file;
          selectedFile.textContent = file ? `Selected: ${file.name}` : 'No file selected.';
        },
        { accept: 'image/jpeg,image/png,image/webp' },
      );
      const selectedFile = el(d, 'p', {
        class: 'muted',
        role: 'status',
        text: state.file ? `Selected: ${state.file.name}` : 'No file selected.',
      });
      const alt = field(d, 'Image description (alt text)', state.alt, (v) => (state.alt = v));
      const upload = button(
        d,
        state.busy ? 'Uploading…' : 'Upload image',
        async () => {
          if (state.busy) return;
          state.alt = alt.querySelector('input').value;
          if (!state.file || state.file.size > 8 * 1024 * 1024) {
            state.error = 'Choose an image smaller than 8 MB.';
            redraw();
            return;
          }
          state.busy = true;
          state.error = '';
          state.status = 'Uploading and optimizing image…';
          redraw();
          try {
            const asset = await adapter.uploadMedia(state.file, state.alt);
            state.busy = false;
            state.file = null;
            state.alt = '';
            state.uploadOpen = false;
            state.activeId = asset.id;
            state.status = 'Image added to your library.';
            if (ctx.isActive?.() === false || !panel.isConnected) ctx.report?.(state.status, false);
            await onDataChanged?.({ ...data, assets: { ...data.assets, [asset.id]: asset } });
            if (!ctx.refresh) {
              data.assets = { ...data.assets, [asset.id]: asset };
            }
            redraw();
          } catch (error) {
            state.busy = false;
            state.error = `${error.message} Select Upload image to retry.`;
            if (ctx.isActive?.() === false || !panel.isConnected) ctx.report?.(state.error);
            redraw();
          }
        },
        {
          icon: 'upload',
          class: 'ui-button primary',
          disabled: state.busy || !adapter.uploadMedia,
        },
      );
      detail.append(
        picker,
        selectedFile,
        alt,
        upload,
        button(d, state.busy ? 'Hide upload' : 'Cancel upload', () => {
          state.uploadOpen = false;
          drawDetail();
        }),
      );
      return;
    }
    const asset = data.assets?.[state.activeId];
    if (!asset || !safeUrl(asset.url, { asset: true })) {
      state.activeId = null;
      detail.hidden = true;
      workspace.classList.remove('has-detail');
      return;
    }
    const name = asset.alt || asset.name || (asset.type === 'video' ? 'Video' : 'Image');
    detail.append(el(d, 'h3', { text: name, tabindex: '-1' }));
    if (asset.type === 'video')
      detail.append(
        el(d, 'video', { src: asset.url, controls: '', preload: 'none', 'aria-label': name }),
      );
    else detail.append(el(d, 'img', { src: asset.url, alt: asset.alt || '', loading: 'lazy' }));
    detail.append(
      el(d, 'p', {
        class: 'muted',
        text:
          asset.width && asset.height
            ? `${asset.width} × ${asset.height} · ${asset.type === 'video' ? 'Video' : 'Image'}`
            : asset.type === 'video'
              ? 'Video'
              : 'Image',
      }),
    );
    const replace =
      selection()?.type === (asset.type === 'video' ? 'video' : 'image') &&
      typeof selection()?.props.assetId !== 'object';
    detail.append(
      button(
        d,
        replace ? 'Replace selected media' : 'Add to page',
        () => choose(state.activeId, asset),
        { icon: 'add', class: 'ui-button primary' },
      ),
      button(d, 'Close details', () => {
        state.activeId = null;
        drawDetail();
        drawGrid();
      }),
    );
  }
  function drawGrid() {
    grid.replaceChildren();
    const entries = sources().filter(
      ([id, a]) =>
        (state.kind === 'all' ||
          (state.kind === 'video' ? a.type === 'video' : a.type !== 'video')) &&
        `${a.alt || ''} ${a.name || ''} ${id}`.toLowerCase().includes(state.search.toLowerCase()),
    );
    count.textContent = `${entries.length} ${entries.length === 1 ? 'item' : 'items'}`;
    if (!entries.length)
      grid.append(
        el(d, 'p', {
          class: 'media-empty',
          text: 'No matching media. Add an image or try another search.',
        }),
      );
    for (const [id, asset] of entries.slice(0, state.shown)) {
      const name = asset.alt || asset.name || (asset.type === 'video' ? 'Video' : 'Image');
      const card = button(
        d,
        '',
        () => {
          state.uploadOpen = false;
          state.activeId = id;
          drawGrid();
          drawDetail();
          detail.querySelector('h3')?.focus({ preventScroll: true });
        },
        {
          class: 'media-card',
          'aria-label': `Select ${name}`,
          'aria-pressed': state.activeId === id,
        },
      );
      if (asset.type !== 'video')
        card.append(el(d, 'img', { src: asset.url, alt: '', loading: 'lazy', decoding: 'async' }));
      else card.append(el(d, 'span', { class: 'media-video-thumbnail' }, [icon(d, 'preview')]));
      card.append(
        el(d, 'span', { class: 'media-card-name', text: name }),
        el(d, 'span', { class: 'muted', text: asset.type === 'video' ? 'Video' : 'Image' }),
      );
      grid.append(card);
    }
    const add = button(
      d,
      '',
      () => {
        state.uploadOpen = true;
        state.activeId = null;
        state.error = '';
        drawGrid();
        drawDetail();
        detail.querySelector('input[type=file]')?.focus({ preventScroll: true });
      },
      {
        class: 'media-card add-media-card',
        'aria-label': 'Add media',
        disabled: !adapter.uploadMedia,
        tooltip: !adapter.uploadMedia
          ? 'Uploads are managed in your project’s media library.'
          : undefined,
      },
    );
    add.append(
      icon(d, 'add'),
      el(d, 'span', { text: 'Add media' }),
      el(d, 'span', {
        class: 'muted',
        text: state.busy ? 'Upload in progress' : 'Upload an image',
      }),
    );
    grid.append(add);
    more.hidden = entries.length <= state.shown;
    more.textContent = `Show more (${Math.max(0, entries.length - state.shown)})`;
  }
  const search = field(d, 'Search media', state.search, (v) => {
    state.search = v;
    state.shown = 24;
    drawGrid();
  });
  search.querySelector('input').addEventListener('input', (e) => {
    state.search = e.target.value;
    state.shown = 24;
    drawGrid();
  });
  toolbar.append(
    search,
    field(
      d,
      'Media type',
      state.kind,
      (v) => {
        state.kind = v;
        state.shown = 24;
        drawGrid();
      },
      {
        options: [
          { value: 'all', label: 'All media' },
          { value: 'image', label: 'Images' },
          { value: 'video', label: 'Videos' },
        ],
      },
    ),
  );
  const count = el(d, 'p', { class: 'muted', role: 'status' });
  const more = button(d, 'Show more', () => {
    state.shown += 24;
    drawGrid();
  });
  panel.append(toolbar, status, count, workspace, more);
  if (!adapter.uploadMedia)
    panel.append(
      el(d, 'p', { class: 'muted', text: 'Upload files through your project’s media library.' }),
    );
  for (const missing of missingAssets(history.document, data)) {
    let replacement = '';
    const row = el(d, 'section', { class: 'inspector-section media-missing' }, [
      el(d, 'h3', { text: `Missing media: ${missing}` }),
      field(d, 'Replace with', '', (v) => (replacement = v), {
        options: [
          { value: '', label: 'Choose replacement' },
          ...sources().map(([id, a]) => ({ value: id, label: a.alt || a.name || id })),
        ],
      }),
    ]);
    row.append(
      button(d, 'Replace references', () => {
        if (!replacement) {
          state.error = 'Choose a replacement first.';
          redraw();
          return;
        }
        command({ type: 'restore', document: remapAsset(history.document, missing, replacement) });
        redraw();
      }),
    );
    panel.append(row);
  }
  for (const slot of emptyMediaSlots(history.document, data)) {
    panel.append(
      el(d, 'section', { class: 'inspector-section media-empty-slot' }, [
        el(d, 'h3', { text: 'Unfilled ' + slot.type }),
        el(d, 'p', {
          class: 'muted',
          text: 'Choose media for this element, or remove it for a text-only layout.',
        }),
        button(d, 'Edit empty ' + slot.type, () => select?.(slot.nodeId)),
      ]),
    );
  }
  drawGrid();
  drawDetail();
}
