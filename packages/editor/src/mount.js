import { openPublication } from './workspace/publication.js';
import { patchCanvas } from './workspace/canvas-patch.js';
import { openReviewCenter } from './workspace/reviews.js';
import { openToolsDialog, workspaceTools } from './workspace/tools-dialog.js';
import { createAppearance } from './workspace/appearance.js';
import {
  canvasElement,
  revealCanvasElement,
  captureWorkspaceFocus,
  restoreWorkspaceFocus,
} from './workspace/focus.js';
import { openComponentCatalog, loadCatalog } from './workspace/component-catalog.js';
import { openLibraryManager } from './workspace/library-manager.js';
import { createRecoveryStore, openRecovery } from './workspace/recovery.js';
import { openRevisionHistory } from './workspace/revisions.js';
import {
  createDocument,
  createHistory,
  findNode,
  findParent,
  containers,
  resolveValue,
  contrastFindings,
  safeUrl,
  prepareContentMode,
} from '@sitebuilder/core';
import {
  renderPage,
  templates,
  elements,
  sectionPresets,
  fontCss,
  enhancePage,
} from '@sitebuilder/renderer';
import {
  el,
  button,
  modal,
  field,
  dragHandle,
  setButtonContent,
  createTooltipProvider,
} from './components/ui/index.js';
import { tokens } from './tokens.js';
import { editorCss } from './workspace/styles.js';
import { createSaveState } from './workspace/save-state.js';
import { renderInspector } from './inspectors/index.js';
import { icon } from './components/ui/icons.js';
import { openLibrary } from './library/dialog.js';
import { openContext } from './workspace/context.js';
import { cloneNode, applyOperation } from '@sitebuilder/core';
import { relativeMove, dropOperation } from './layout/index.js';
export function mountEditor(element, options = {}) {
  if (!element?.ownerDocument) throw new Error('A host DOM element is required.');
  const d = element.ownerDocument,
    win = d.defaultView,
    root = element.shadowRoot || element.attachShadow({ mode: 'open' });
  root.replaceChildren();

  const adapter = options.adapter || {};
  const componentDescriptors = new Map();
  let componentDialog = null;
  let dataStatus = { state: 'ready', updatedAt: new Date().toISOString(), error: '' };
  let refreshGeneration = 0;
  async function refreshData() {
    if (!adapter.loadData || dataStatus.state === 'loading') return;
    const token = ++refreshGeneration;
    requestData++;
    dataStatus = { ...dataStatus, state: 'loading', error: '' };
    toolsDialog?.update(true);
    try {
      const next = await adapter.loadData();
      if (destroyed || token !== refreshGeneration) return;
      data = next;
      dataStatus = { state: 'ready', updatedAt: new Date().toISOString(), error: '' };
      render();
    } catch (error) {
      if (!destroyed && token === refreshGeneration) {
        dataStatus = { ...dataStatus, state: 'error', error: error.message };
        toolsDialog?.update(true);
      }
    }
  }
  let data = options.data || {},
    selectedId = options.document?.id || null,
    tab = 'layers',
    layerQuery = '',
    collapsed = new Set(),
    savedSections = [],
    savedTemplates = [],
    savedLibraryNext = null,
    breakpoint = 'desktop',
    reviewedWidth = null,
    canvasMode = null,
    zoom = 0.75,
    preview = false,
    destroyed = false,
    sessionActive = true,
    suppress = false,
    inline = null,
    dragId = null,
    resizeObserver = null,
    requestData = 0,
    initialFit = true,
    previewCleanup = null,
    libraryRequest = 0,
    libraryDialog = null,
    toolsDialog = null,
    deferRender = false,
    pendingRender = false,
    focusReleaseTimer = null;
  const builder = el(d, 'div', { class: 'builder' }),
    top = el(d, 'header', { class: 'topbar' }),
    workspace = el(d, 'div', { class: 'workspace' }),
    toolrail = el(d, 'nav', { class: 'toolrail', 'aria-label': 'Studio tools' }),
    rail = el(d, 'aside', { class: 'rail', 'aria-label': 'Pages, elements, and templates' }),
    stage = el(d, 'section', { class: 'canvas-stage', 'aria-label': 'Website canvas' }),
    inspector = el(d, 'aside', { class: 'inspector', 'aria-label': 'Selected element settings' }),
    status = el(d, 'div', { class: 'statusbar' }),
    message = el(d, 'span', {
      class: 'status-message',
      role: 'status',
      'aria-live': 'polite',
      text: 'Ready to edit',
    }),
    name = el(d, 'div', { class: 'document-name' });
  root.append(el(d, 'style', { text: fontCss + editorCss }), builder);
  builder.append(top, workspace, status);
  workspace.append(toolrail, rail, stage, inspector);
  status.append(
    message,
    el(d, 'span', {
      class: 'muted',
      text: options.demo ? 'Example workspace · local development' : 'Shared website builder',
    }),
  );
  const report = (text, isError = true) => {
    message.textContent = text;
    message.classList.toggle('error', isError);
    toolsDialog?.report(text, isError);
  };
  let storage;
  try {
    storage = win.localStorage;
  } catch {}
  const appearance = createAppearance(element, { storage, initial: options.appearance });
  const tooltips = createTooltipProvider(root);
  const recovery = createRecoveryStore({
    storage,
    scope: adapter.recoveryScope || adapter.workspace?.recoveryScope,
    websiteId: options.document?.id,
  });
  const recovered = recovery.read();
  let unresolvedRecovery = recovered.ok ? recovered.entry : null;
  const recoveryStatus = el(d, 'span', { class: 'muted', 'aria-live': 'polite' });
  status.append(recoveryStatus);
  const persistRecovery = (doc, version) => {
    if (destroyed || !sessionActive) return;
    if (unresolvedRecovery) {
      recoveryStatus.textContent = 'Previous unsaved recovery retained. Open Recover to review it.';
      return;
    }
    const result = recovery.write(doc, version);
    recoveryStatus.textContent = result.ok
      ? 'Recovery copy retained locally'
      : result.reason === 'scope-required'
        ? ''
        : 'Local recovery unavailable; use Export if saving fails.';
  };
  const save = createSaveState(adapter, {
    onPending: persistRecovery,
    onSettled: () => {
      if (destroyed || !sessionActive) return;
      if (unresolvedRecovery) return;
      if (inline && inline.value !== inline.original && !inline.composing)
        persistRecovery(getDocument(), save.version);
      else {
        recovery.clear();
        recoveryStatus.textContent = '';
      }
    },
    version: options.version || 0,
    delay: options.saveDelay ?? 650,
    onState: (s) => {
      const labels = {
        unsaved: 'Unsaved changes',
        saving: 'Saving draft…',
        saved: 'All changes saved',
        offline: 'Offline — your edits are retained. Retry when connected.',
        conflict: 'A newer draft exists. Export your changes, then reload to reconcile.',
        error: 'Could not save the draft.',
      };
      report(
        s.error ? `${labels[s.state]} ${s.error.message}` : labels[s.state],
        ['error', 'conflict', 'offline'].includes(s.state),
      );
    },
  });
  const history = createHistory(
    options.document || createDocument(),
    (doc) => {
      if (!suppress) {
        save.request(doc);
        options.onChange?.(structuredClone(doc));
      }
      render();
    },
    (document, operation) => prepareContentMode(document, operation, data),
  );
  selectedId = selectedId || history.document.id;
  const command = (op) => {
    if (!sessionActive) {
      report('Your session ended. Sign in again before editing.');
      return false;
    }
    try {
      flushInline();
      const previousMode = history.document.mode;
      history.apply(op);
      report(
        previousMode !== history.document.mode && history.document.mode === 'live'
          ? 'Draft updated · Live data is enabled for the connected content. Undo restores the previous layout and mode.'
          : 'Draft updated',
        false,
      );
      return true;
    } catch (e) {
      report(e.message);
      return false;
    }
  };
  function context(panel = inspector) {
    return {
      d,
      root,
      panel,
      history,
      selectedId,
      breakpoint,
      data,
      adapter,
      command,
      report,
      select,
      onDataChanged: async (value) => {
        if (destroyed) return;
        data = { ...data, assets: { ...data.assets, ...value.assets } };
        toolsDialog?.update();
        renderCanvas();
        inspect();
        renderRail();
      },
      download,
      enableFreeform: options.enableFreeform === true,
      componentDescriptors,
      dataStatus,
      refreshData,
      revealNode: (id) => {
        toolsDialog?.close({ restoreFocus: false });
        select(id);
      },
      showGlobals,
      showBrand: () => showTool('brand'),
      insertNode,
      onGlobalsChanged: async () => {
        if (adapter.loadData) data = await adapter.loadData();
        if (!destroyed) {
          renderCanvas();
          inspect();
          renderSelection();
          toolsDialog?.update(true);
        }
      },
    };
  }
  function download(filename, value) {
    const blob = new win.Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    if (!win.URL.createObjectURL) {
      options.onExport?.(value);
      return;
    }
    const url = win.URL.createObjectURL(blob);
    const a = el(d, 'a', { href: url, download: filename });
    a.click();
    setTimeout(() => win.URL.revokeObjectURL(url), 1000);
  }
  function flushInline() {
    if (!inline || inline.composing) return;
    const pending = inline;
    inline = null;
    if (pending.value !== pending.original) {
      try {
        history.apply({ type: 'text', id: pending.id, value: pending.value });
      } catch (e) {
        report(e.message);
      }
    }
  }
  const brand = el(d, 'div', { class: 'brand-lockup' }, [
    el(d, 'div', { class: 'studio-brand' }, [
      el(d, 'img', {
        class: 'studio-icon',
        src: new URL('./assets/pixelcore-studio-icon.webp', import.meta.url).href,
        alt: '',
        width: '38',
        height: '38',
      }),
      el(d, 'div', { class: 'studio-wordmark' }, [
        el(d, 'span', { class: 'studio-name', text: 'Pixelcore' }),
        el(d, 'span', { class: 'studio-label', text: 'Studio' }),
      ]),
    ]),
    el(d, 'div', { class: 'document-context' }, [
      ...(adapter.workspace?.sourceName
        ? [el(d, 'div', { class: 'brand', text: adapter.workspace.sourceName })]
        : []),
      name,
    ]),
  ]);
  if (adapter.exit) {
    const back = button(d, '', () => adapter.exit(), {
      'aria-label': options.exitLabel || 'Back to PixelCore',
      tooltip: options.exitLabel || 'Back to PixelCore',
      class: 'ui-button icon-button',
    });
    back.append(icon(d, 'back'));
    brand.prepend(back);
  }
  const tools = el(d, 'div', { class: 'toolbar' });
  const historyTools = el(d, 'div', { class: 'toolbar-group' });
  const undo = button(d, '', () => {
      flushInline();
      history.undo();
    }),
    redo = button(d, '', () => {
      flushInline();
      history.redo();
    });
  undo.setAttribute('aria-label', 'Undo');
  undo.setAttribute('data-tooltip', 'Undo (Ctrl/⌘ Z)');
  undo.append(icon(d, 'undo'));
  redo.setAttribute('aria-label', 'Redo');
  redo.setAttribute('data-tooltip', 'Redo (Ctrl/⌘ Shift Z)');
  redo.append(icon(d, 'redo'));
  historyTools.append(
    undo,
    redo,
    button(d, 'Export', () => download('website-draft.json', getDocument()), {
      class: 'ui-button quiet-action',
      icon: 'download',
    }),
  );
  function setPreview(value) {
    cancelLibrary();
    flushInline();
    preview = value;
    workspace.classList.toggle('preview-mode', preview);
    if (preview) workspace.classList.remove('show-left', 'show-properties');
    setButtonContent(
      previewButton,
      preview ? 'Back to editing' : 'Preview',
      preview ? 'back' : 'preview',
    );
    previewButton.setAttribute('aria-pressed', String(preview));
    renderCanvas();
    syncNavigation();
    if (preview)
      report(
        'Preview is interactive. Links open separately; host actions require the live website.',
        false,
      );
  }
  const previewButton = button(d, 'Preview', () => setPreview(!preview), {
    icon: 'preview',
    'aria-pressed': 'false',
  });
  const saveButton = button(
    d,
    'Save draft',
    async () => {
      flushInline();
      await save.flush();
      if (!save.dirty && !save.error) report('All changes saved', false);
    },
    {
      icon: 'save',
      disabled: !adapter.saveDraft,
      tooltip: adapter.saveDraft ? undefined : 'Draft saving is not connected by this project.',
    },
  );
  const reviewButton = button(
    d,
    'Share',
    async () => {
      if (!adapter.createReview) return report('This host has not configured shareable previews.');
      if (adapter.listReviews)
        return openReviewCenter({
          root,
          adapter,
          create: async (settings) => {
            flushInline();
            await save.flush();
            if (save.error || save.dirty) throw save.error || new Error('Save your draft first.');
            return adapter.createReview(history.document, save.version, settings);
          },
          onJump: (id, width) => {
            if (!findNode(history.document, id))
              return report(
                'This element belongs to an older revision and is no longer in the current draft. Use History to inspect that revision.',
              );
            reviewedWidth = Math.max(320, Math.min(2560, width));
            breakpoint = width <= 600 ? 'phone' : width <= 960 ? 'tablet' : 'desktop';
            renderCanvas();
            updateDeviceButtons();
            select(id);
          },
        });

      flushInline();
      await save.flush();
      if (save.error || save.dirty) return;
      reviewButton.disabled = true;
      try {
        const r = await adapter.createReview(history.document, save.version);
        if (destroyed) return;
        if (!r?.url) throw new Error('The host did not return a review URL.');
        const link = el(d, 'a', {
          href: r.url,
          text: r.url,
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'review-link',
        });
        modal(
          root,
          'Share this saved preview',
          el(d, 'div', {}, [
            el(d, 'p', {
              text: 'Anyone with this link can view this saved revision and leave a named comment until the link expires.',
            }),
            link,
          ]),
          () => {},
          { confirmLabel: 'Done' },
        );
      } catch (e) {
        report(e.message);
      } finally {
        if (!destroyed) reviewButton.disabled = false;
      }
    },
    {
      disabled: !adapter.createReview,
      class: 'ui-button review-action',
      icon: 'share',
      tooltip: !adapter.createReview
        ? 'Preview sharing is not connected by this project.'
        : undefined,
    },
  );
  const publish = button(
    d,
    'Publish',
    () => {
      flushInline();
      return openPublication({
        root,
        document: history.document,
        data,
        adapter,
        onSelect: (id) => select(id),
        onHistory: showHistory,
        onPublish: async () => {
          flushInline();
          publish.disabled = true;
          try {
            await save.flush();
            if (save.error || save.dirty) throw save.error || new Error('Save the draft first.');
            if (!adapter.publish) throw new Error('Publishing is not configured.');
            await adapter.publish(save.version);
            report('Website published', false);
          } catch (e) {
            report(e.message);
            throw e;
          } finally {
            if (!destroyed) publish.disabled = false;
          }
        },
      });
    },
    {
      class: 'ui-button primary',
      disabled: !adapter.publish,
      icon: 'publish',
      tooltip: !adapter.publish ? 'Publishing is not connected by this project.' : undefined,
    },
  );
  const recoverButton = button(d, 'Recover', showRecovery, {
    'aria-label': 'Recover unsaved work',
    class: 'ui-button quiet-action',
    icon: 'history',
    hidden: !unresolvedRecovery,
  });
  const historyButton = button(d, 'History', showHistory, {
    'aria-label': 'Revision history',
    icon: 'history',
    disabled: !adapter.listRevisions,
    class: 'ui-button quiet-action',
  });
  tools.append(
    historyTools,
    recoverButton,
    historyButton,
    previewButton,
    saveButton,
    reviewButton,
    publish,
  );
  top.append(brand, tools);
  const headerExtension = options.mountHeader
    ? el(d, 'div', { class: 'editor-header-extension' })
    : null;
  let destroyHeader;
  if (headerExtension) {
    top.append(headerExtension);
    destroyHeader = options.mountHeader(headerExtension, { root, appearance });
  }
  status.append(
    button(
      d,
      'Save now',
      async () => {
        flushInline();
        await save.flush();
        if (!save.dirty && !save.error) report('All changes saved', false);
      },
      { disabled: !adapter.saveDraft },
    ),
  );
  const canvasToolbar = el(d, 'div', { class: 'canvas-toolbar' }),
    deviceTools = el(d, 'div', { class: 'device-controls', 'aria-label': 'Canvas viewport' }),
    zoomTools = el(d, 'div', { class: 'zoom-controls' }),
    selectionBar = el(d, 'div', { class: 'selection-bar' }),
    slot = el(d, 'div', { class: 'canvas-slot' }),
    frame = el(d, 'iframe', {
      class: 'canvas-frame',
      title: 'Editable website canvas',
      sandbox: 'allow-same-origin',
      srcdoc: '<!doctype html><html><body></body></html>',
      referrerpolicy: 'no-referrer',
    });
  for (const [bp, label] of [
    ['desktop', 'Desktop'],
    ['tablet', 'Tablet'],
    ['phone', 'Phone'],
  ])
    deviceTools.append(
      button(
        d,
        '',
        () => {
          flushInline();
          breakpoint = bp;
          reviewedWidth = null;
          ((initialFit = true), (previewCleanup = null));
          renderCanvas();
          inspect();
          updateDeviceButtons();
        },
        { 'data-breakpoint': bp, 'aria-label': label, tooltip: label },
      ),
    );
  for (const b of deviceTools.children) b.append(icon(d, b.dataset.breakpoint));
  const zoomLabel = el(d, 'span', { text: '75%' });
  zoomTools.append(
    button(d, '', () => setZoom(zoom - 0.1), {
      'aria-label': 'Zoom out',
      icon: 'zoomOut',
      tooltip: 'Zoom out',
    }),
    zoomLabel,
    button(d, '', () => setZoom(zoom + 0.1), {
      'aria-label': 'Zoom in',
      icon: 'zoomIn',
      tooltip: 'Zoom in',
    }),
    button(d, 'Fit', () => {
      const available = stage.clientWidth || 800;
      setZoom(
        Math.min(
          1,
          (available - 60) /
            (breakpoint === 'desktop' ? 1100 : breakpoint === 'tablet' ? 768 : 390),
        ),
      );
    }),
  );
  const widthLabel = el(d, 'span', { class: 'canvas-width' });
  canvasToolbar.append(widthLabel, zoomTools);
  top.insertBefore(deviceTools, tools);
  saveButton.classList.add('save-action');
  slot.append(frame);
  stage.append(canvasToolbar, selectionBar, slot);
  function updateDeviceButtons() {
    for (const b of deviceTools.children)
      b.setAttribute('aria-pressed', String(b.dataset.breakpoint === breakpoint));
  }
  function setZoom(value) {
    zoom = Math.max(0.25, Math.min(1.5, value));
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    layoutCanvas();
  }
  function layoutCanvas() {
    const width =
      reviewedWidth || (breakpoint === 'desktop' ? 1100 : breakpoint === 'tablet' ? 768 : 390);
    if (initialFit && stage.clientWidth) {
      zoom = Math.max(0.25, Math.min(1, (stage.clientWidth - 60) / width));
      zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
      initialFit = false;
    }
    widthLabel.textContent = `${width}px · ${breakpoint === 'phone' ? 'Phone' : breakpoint === 'tablet' ? 'Tablet' : 'Desktop'}`;
    frame.style.width = `${width}px`;
    frame.style.transform = `scale(${zoom})`;
    const h = Math.max(650, frame.contentDocument?.documentElement?.scrollHeight || 0);
    frame.style.height = `${h}px`;
    slot.style.width = `${width * zoom}px`;
    slot.style.height = `${h * zoom}px`;
  }
  function insertNode(value) {
    const selected = findNode(history.document, selectedId);
    const parent =
      selected &&
      containers.includes(selected.type) &&
      !['global-section', 'repeater'].includes(selected.type)
        ? selected
        : history.document;
    if (command({ type: 'insert', id: parent.id, node: value })) select(value.id);
  }
  function showTool(key) {
    if (destroyed || !workspaceTools[key]) return;
    flushInline();
    cancelLibrary();
    tooltips.hide();
    if (toolsDialog) {
      toolsDialog.switchTo(key);
      syncNavigation();
      return;
    }
    toolsDialog = openToolsDialog({
      root,
      key,
      getContext: context,
      onSwitch: syncNavigation,
      onClose: () => {
        toolsDialog = null;
        syncNavigation();
      },
    });
    syncNavigation();
  }
  function showGlobals() {
    showTool('globals');
  }
  async function showHistory() {
    flushInline();
    if (!adapter.listRevisions || !adapter.readRevision)
      return report('This host has not connected revision history.');
    openRevisionHistory({
      root,
      adapter,
      currentVersion: save.version,
      document: history.document,
      data,
      onRestore: async (revision) => {
        await save.flush();
        if (save.error || save.dirty)
          throw save.error || new Error('Save or export the current draft before restoring.');
        const result = await adapter.restoreRevision(revision.id, save.version);
        if (destroyed) return;
        suppress = true;
        try {
          history.replace(result.document);
          save.reset(result.version);
          data = result.data || data;
          selectedId = history.document.id;
        } finally {
          suppress = false;
        }
        render();
        report('Revision restored as a new draft. The live publication is unchanged.', false);
      },
      onError: (e) => report(e.message),
    });
  }
  function inspect() {
    const region = data.frame?.regions?.find((n) => n.id === selectedId);
    if (region && !findNode(history.document, selectedId)) {
      inspector.replaceChildren(
        el(d, 'h2', { class: 'panel-heading', text: region.props.name || region.type }),
        el(d, 'span', { class: 'badge', text: 'Global · site-wide' }),
        el(d, 'p', {
          class: 'muted',
          text: 'This region is shared by the site. Its content and behavior are managed by PixelCore.',
        }),
      );
      if (adapter.openRegion)
        inspector.append(button(d, 'Edit site-wide layout', () => adapter.openRegion(region.type)));
      return;
    }
    renderInspector(context());
  }
  function focusInspector(control = false) {
    const heading = inspector.querySelector('h2');
    if (heading) heading.tabIndex = -1;
    const target = control
      ? [
          ...inspector.querySelectorAll(
            'input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled),summary',
          ),
        ].find((n) => n.tagName === 'SUMMARY' || !n.closest('details:not([open])')) || heading
      : heading;
    inspector.scrollTop = 0;
    target?.focus({ preventScroll: true });
  }
  function openProperties() {
    if (preview) setPreview(false);
    workspace.classList.remove('show-left');
    workspace.classList.add('show-properties');
    inspect();
    syncNavigation();
    focusInspector(true);
  }
  function select(id, { focus = 'canvas', reveal = true } = {}) {
    if (destroyed) return false;
    const node = findNode(history.document, id) || data.frame?.regions?.find((n) => n.id === id);
    if (!node) {
      report('This element is no longer available. Select another layer.');
      return false;
    }
    if (inline?.composing && inline.id !== id) {
      report('Finish entering text before selecting another element.', false);
      return false;
    }
    toolsDialog?.close({ restoreFocus: false });
    cancelLibrary();
    if (inline && inline.id !== id) flushInline();
    selectedId = id;
    for (
      let parent = findParent(history.document, id);
      parent;
      parent = findParent(history.document, parent.id)
    )
      collapsed.delete(parent.id);
    renderSelection();
    inspect();
    inspector.scrollTop = 0;
    renderLayersOnly();
    if (
      tab === 'layers' &&
      ![...rail.querySelectorAll('[data-layer-id]')].some((n) => n.dataset.layerId === id) &&
      layerQuery
    ) {
      layerQuery = '';
      const search = rail.querySelector('.layer-search input');
      if (search) search.value = '';
      renderLayersOnly();
    }
    if (focus !== 'none' && !(inline?.id === id)) {
      if (win.innerWidth < 950) workspace.classList.remove('show-left');
      if (win.innerWidth < 650 || focus === 'inspector') {
        workspace.classList.add('show-properties');
        focusInspector();
      } else {
        const target = canvasElement(frame, id, history.document.id);
        if (target) {
          target.tabIndex = 0;
          if (reveal) revealCanvasElement(target, frame, stage, zoom);
          target.focus({ preventScroll: true });
        }
      }
    }
    const layer = [...rail.querySelectorAll('[data-layer-id]')].find(
      (n) => n.dataset.layerId === id,
    );
    if (reveal) layer?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    syncNavigation();
    return true;
  }
  function renderSelection() {
    for (const n of frame.contentDocument?.querySelectorAll('[data-wb-selected]') || [])
      n.removeAttribute('data-wb-selected');
    for (const n of frame.contentDocument?.querySelectorAll('[data-wb-id]') || [])
      if (!preview && n.dataset.wbId === selectedId) n.setAttribute('data-wb-selected', '');
    const n =
      findNode(history.document, selectedId) ||
      data.frame?.regions?.find((n) => n.id === selectedId) ||
      history.document;
    const globalRegion = !findNode(history.document, n.id);
    selectionBar.replaceChildren(
      el(d, 'span', {
        class: 'selection-label',
        text: n.props.name || `${n.type[0].toUpperCase() + n.type.slice(1)}`,
        role: 'status',
      }),
    );
    const movable = n.type !== 'page' && !globalRegion;
    if (movable)
      selectionBar.append(button(d, 'Edit properties', openProperties, { icon: 'edit' }));
    if (movable)
      selectionBar.append(
        button(
          d,
          'Move up',
          () => {
            const op = relativeMove(history.document, n.id, -1);
            if (op && command(op)) select(n.id);
          },
          { icon: 'up', disabled: !relativeMove(history.document, n.id, -1) },
        ),
        button(
          d,
          'Move down',
          () => {
            const op = relativeMove(history.document, n.id, 1);
            if (op && command(op)) select(n.id);
          },
          { icon: 'down', disabled: !relativeMove(history.document, n.id, 1) },
        ),
        button(
          d,
          'Duplicate',
          () => {
            if (command({ type: 'duplicate', id: n.id })) {
              const parent = findParent(history.document, n.id);
              const copy =
                parent.children[parent.children.findIndex((child) => child.id === n.id) + 1];
              select(copy.id);
            }
          },
          {
            icon: 'copy',
            disabled: findParent(history.document, n.id)?.type === 'repeater',
            tooltip:
              findParent(history.document, n.id)?.type === 'repeater'
                ? 'A collection needs one card template. Duplicate elements inside the card instead.'
                : undefined,
          },
        ),
        button(
          d,
          'Remove',
          () => {
            selectedId = findParent(history.document, n.id)?.id || history.document.id;
            if (!command({ type: 'remove', id: n.id })) return;
            select(selectedId);
            report('Element removed. Undo is available.', false);
          },
          {
            class: 'ui-button danger',
            icon: 'remove',
            disabled: findParent(history.document, n.id)?.type === 'repeater',
            tooltip:
              findParent(history.document, n.id)?.type === 'repeater'
                ? 'Keep the collection card template. Remove the collection to remove all its cards.'
                : undefined,
          },
        ),
      );
    if (n.type === 'section' && adapter.saveSection)
      selectionBar.append(
        button(
          d,
          'Save section',
          async (e) => {
            const control = e.currentTarget;
            if (control.disabled) return;
            control.disabled = true;
            control.setAttribute('aria-busy', 'true');
            try {
              await adapter.saveSection(n.props.name || 'Saved section', n);
              report('Section saved to your library', false);
            } catch (e) {
              report(e.message);
            } finally {
              if (control.isConnected) {
                control.disabled = false;
                control.removeAttribute('aria-busy');
              }
            }
          },
          { icon: 'save' },
        ),
      );
    if (n.type !== 'page' && !globalRegion) {
      const descendants = new Set();
      const collect = (item) => {
        descendants.add(item.id);
        item.children.forEach(collect);
      };
      collect(n);
      const destinations = [];
      const visit = (item) => {
        if (item.type === 'global-section') return;
        if (
          !['repeater'].includes(item.type) &&
          !descendants.has(item.id) &&
          containers.includes(item.type)
        )
          destinations.push({
            value: item.id,
            label: item.props.name || (item.type === 'page' ? history.document.title : item.type),
          });
        item.children.forEach(visit);
      };
      visit(history.document);
      selectionBar.append(
        field(
          d,
          'Move into',
          findParent(history.document, n.id)?.id,
          (parentId) => command({ type: 'move', id: n.id, parentId }),
          {
            options: destinations,
            readonly: findParent(history.document, n.id)?.type === 'repeater',
          },
        ),
      );
    }
  }
  function renderLayersOnly() {
    if (tab !== 'layers') return;
    const area = rail.querySelector('[data-outline]');
    if (!area) return;
    area.replaceChildren();
    const item = (n, depth = 0) => {
      const label =
        n.props.name ||
        (['heading', 'text'].includes(n.type)
          ? String(resolveValue(n.props.text, data) || n.type).slice(0, 30)
          : n.type === 'page'
            ? history.document.title
            : n.type);
      const match = (value) =>
        (
          value.props?.name ||
          (typeof value.props?.text === 'string' ? value.props.text : '') ||
          value.type
        )
          .toLowerCase()
          .includes(layerQuery.toLowerCase()) || value.children?.some(match);
      if (layerQuery && !match(n)) return;
      const row = el(d, 'div', { class: 'outline-row', draggable: n.type !== 'page' });
      row.style.paddingLeft = `${depth * 10}px`;
      if (n.children.length) {
        const toggle = button(
          d,
          '',
          () => {
            collapsed.has(n.id) ? collapsed.delete(n.id) : collapsed.add(n.id);
            renderLayersOnly();
          },
          {
            class: 'ui-button tree-toggle',
            'aria-label': `Toggle ${label}`,
            'aria-expanded': !collapsed.has(n.id),
          },
        );
        toggle.append(icon(d, 'chevron'));
        row.append(toggle);
      } else row.append(el(d, 'span', { class: 'tree-leaf', 'aria-hidden': 'true' }));
      row.append(
        el(
          d,
          'span',
          {
            class: 'outline-drag',

            'aria-hidden': 'true',
          },
          n.type === 'page' ? [] : [dragHandle(d)],
        ),
        button(d, label, () => select(n.id), {
          'aria-pressed': n.id === selectedId,
          'data-layer-id': n.id,
        }),
      );
      row.addEventListener('dragstart', (e) => {
        dragId = n.id;
        e.dataTransfer?.setData('text/plain', n.id);
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        row.style.outline = '1px solid var(--editor-focus)';
      });
      row.addEventListener('dragleave', () => (row.style.outline = ''));
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        row.style.outline = '';
        if (dragId && dragId !== n.id) {
          try {
            command(
              dropOperation(
                history.document,
                dragId,
                n.id,
                containers.includes(n.type) && e.shiftKey,
              ),
            );
          } catch (err) {
            report(err.message);
          }
        }
        dragId = null;
      });
      area.append(row);
      if (!collapsed.has(n.id) || layerQuery) for (const c of n.children) item(c, depth + 1);
    };
    for (const region of data.frame?.regions?.filter((n) => n.type === 'header') || [])
      area.append(
        button(d, `${region.props.name || 'Header'} · Global`, () => select(region.id), {
          'aria-pressed': region.id === selectedId,
          'data-layer-id': region.id,
        }),
      );
    item(history.document);
    for (const region of data.frame?.regions?.filter((n) => n.type === 'footer') || [])
      area.append(
        button(d, `${region.props.name || 'Footer'} · Global`, () => select(region.id), {
          'aria-pressed': region.id === selectedId,
          'data-layer-id': region.id,
        }),
      );
  }
  function cancelLibrary() {
    libraryRequest++;
    libraryDialog?.close();
    libraryDialog = null;
  }
  async function showLibrary(kind = 'add') {
    flushInline();
    if (adapter.workspace?.kind === 'layout' && kind === 'templates') {
      report(
        'Apply templates from a page workspace. This workspace edits the global header and footer.',
        false,
      );
      return;
    }
    cancelLibrary();
    const request = libraryRequest;
    report(
      kind === 'templates' ? 'Loading template library…' : 'Loading sections and elements…',
      false,
    );
    let libraryError = '';
    try {
      if (adapter.listDesigns) {
        const page = await adapter.listDesigns(kind === 'templates' ? 'templates' : 'sections');
        if (request !== libraryRequest || destroyed) return;
        savedLibraryNext = page.nextOffset;
        if (kind === 'templates') savedTemplates = page.designs;
        else savedSections = page.designs;
      } else if (kind === 'templates' && adapter.listTemplates)
        savedTemplates = await adapter.listTemplates();
      else if (kind !== 'templates' && adapter.listSections)
        savedSections = await adapter.listSections();
    } catch (e) {
      if (request !== libraryRequest || destroyed) return;
      libraryError = `${e.message} Close and reopen the library to retry.`;
      report(libraryError);
    }
    if (destroyed || request !== libraryRequest) return;
    if (!libraryError)
      report(
        kind === 'templates'
          ? 'Choose a template to preview.'
          : 'Choose a section or element to preview.',
        false,
      );
    libraryDialog = openLibrary({
      root,
      kind,
      document: history.document,
      data,
      capabilities: adapter.capabilities || [],
      workspace: adapter.workspace || {},
      savedTemplates,
      nextSavedOffset: savedLibraryNext,
      onReadDesign: adapter.readDesign
        ? (id) => adapter.readDesign(kind === 'templates' ? 'templates' : 'sections', id)
        : undefined,
      onLoadSaved: adapter.listDesigns
        ? (offset, q) =>
            adapter.listDesigns(kind === 'templates' ? 'templates' : 'sections', { offset, q })
        : undefined,
      onManage: adapter.updateDesign
        ? () => openLibraryManager({ root, adapter, document: history.document, download })
        : undefined,
      libraryError,
      onSaveTemplate: adapter.saveTemplate
        ? async (name, doc, description) => {
            const saved = await adapter.saveTemplate(name, doc, description);
            savedTemplates.unshift(saved);
            return saved;
          }
        : undefined,
      onExportTemplate: (value) => download('website-template.json', value),
      saved: savedSections.map((e) => ({
        ...e,
        category: 'Saved',
        needsLoad: !e.node,
        create: e.node ? () => cloneNode(e.node) : undefined,
      })),
      onChoose(value, { replace, position }) {
        if (replace) {
          value.id = history.document.id;
          value.title = history.document.title;
          value.context = history.document.context;
          value.seo = history.document.seo;
          value.analytics = history.document.analytics;
          value.theme.headingFont = history.document.theme.headingFont;
          value.theme.bodyFont = history.document.theme.bodyFont;
          if (data.frame?.owner === 'host')
            value.children = value.children.filter((n) => !['header', 'footer'].includes(n.type));
          command({ type: 'restore', document: value });
          select(value.id);
          return;
        }
        if (data.frame?.owner === 'host' && ['header', 'footer'].includes(value.type)) {
          const region = data.frame.regions?.find((n) => n.type === value.type);
          if (region) select(region.id);
          report('Edit this region in the site-wide layout.', false);
          return;
        }
        if (adapter.workspace?.kind === 'layout' && !['header', 'footer'].includes(value.type)) {
          report(
            'Choose a header or footer for the site-wide layout. Add content in a page workspace.',
          );
          return;
        }
        const selected = findNode(history.document, selectedId) || history.document;
        let parent = history.document,
          index = parent.children.length;
        if (['header', 'footer'].includes(value.type)) {
          index = value.type === 'header' ? 0 : parent.children.length;
        } else if (position === 'inside' && containers.includes(selected.type)) {
          parent = selected;
          index = parent.children.length;
        } else if (position !== 'end' && selected.type !== 'page') {
          parent = findParent(history.document, selected.id) || parent;
          index = parent.children.findIndex((n) => n.id === selected.id) + 1;
        } else {
          const footer = parent.children.findIndex((n) => n.type === 'footer');
          if (footer >= 0) index = footer;
        }
        if (command({ type: 'insert', id: parent.id, index, node: value })) select(value.id);
      },
    });
  }
  async function showSetup() {
    cancelLibrary();
    flushInline();
    let kit;
    try {
      kit = await adapter.getBrandKit?.();
    } catch (e) {
      report(e.message);
    }
    if (!destroyed)
      openContext({
        root,
        data,
        document: history.document,
        workspace: {
          ...(adapter.workspace || {}),
          features: adapter.capabilities || [],
          regions: data.frame?.regions?.map((n) => ({ owner: data.frame.owner, kind: n.type })),
          changeSource: adapter.changeSource,
        },
        brandKit: kit,
        onApply: (document) => {
          command({ type: 'restore', document });
          select(document.id);
        },
      });
  }
  function renderRail() {
    rail.replaceChildren();
    const tabs = el(d, 'nav', { class: 'panel-tabs', 'aria-label': 'Page navigation' });
    for (const [key, label] of [
      ['layers', 'Layers'],
      ['pages', 'Pages'],
    ])
      tabs.append(
        button(
          d,
          label,
          () => {
            tab = key;
            renderRail();
            syncNavigation();
          },
          { 'aria-pressed': tab === key },
        ),
      );
    rail.append(tabs);
    if (tab === 'pages') {
      rail.append(el(d, 'h2', { class: 'panel-heading', text: 'Pages' }));
      const pages = adapter.workspace?.pages || [];
      const list = el(d, 'div', { class: 'page-list' });
      for (const page of pages)
        list.append(
          button(d, page.title, () => adapter.openPage?.(page), {
            'aria-current': page.sourceId === adapter.workspace.sourceId ? 'page' : undefined,
            disabled: !adapter.openPage,
          }),
        );
      if (!pages.length)
        list.append(
          el(d, 'p', { class: 'page-empty', text: 'This workspace contains one connected page.' }),
        );
      if (adapter.createPage) list.append(button(d, 'Create page', () => adapter.createPage()));
      rail.append(list);
      return;
    }
    rail.append(el(d, 'h2', { class: 'panel-heading', text: 'Page structure' }));
    const search = field(d, 'Find a layer', layerQuery, (v) => {
      layerQuery = v;
      renderLayersOnly();
    });
    search.classList.add('layer-search');
    search.querySelector('input').addEventListener('input', (e) => {
      layerQuery = e.target.value;
      renderLayersOnly();
    });
    rail.append(search, el(d, 'div', { 'data-outline': '' }));
    renderLayersOnly();
    if (data.frame?.owner === 'host')
      rail.append(
        el(d, 'p', {
          class: 'region-note',
          text: 'Header and footer are global. Select one to edit the site-wide layout.',
        }),
      );
  }
  for (const [key, label, glyph] of [
    ['layers', 'Pages and layers', 'layers'],
    ['elements', 'Add section or element', 'add'],
    ['templates', 'Templates', 'templates'],
    ['data', 'Connect system data', 'data'],
    ['globals', 'Shared sections', 'shared'],
    ['media', 'Media library', 'media'],
    ['brand', 'Theme and branding', 'theme'],
    ['properties', 'Selected element settings', 'settings'],
  ]) {
    const b = button(
      d,
      '',
      () => {
        tooltips.hide();
        cancelLibrary();
        if (preview) setPreview(false);
        if (key === 'elements' || key === 'templates') {
          showLibrary(key === 'templates' ? 'templates' : 'add');
          return;
        }
        if (workspaceTools[key]) {
          showTool(key);
          return;
        }
        if (key === 'properties') {
          openProperties();
          return;
        }
        workspace.classList.remove('show-properties');
        workspace.classList.toggle(
          'show-left',
          key === tab ? !workspace.classList.contains('show-left') : true,
        );
        tab = key;
        renderRail();
        syncNavigation();
      },
      {
        tooltip: label,
        'aria-label': label,
        'aria-pressed': key === tab,
        'data-tool': key,
        'data-tooltip-placement': 'right',
      },
    );
    b.append(icon(d, glyph));
    toolrail.append(b);
  }
  if (options.componentCatalog?.url) {
    const catalogButton = button(
      d,
      '',
      async () => {
        if (componentDialog?.isOpen) return;
        componentDialog = openComponentCatalog(context(), options.componentCatalog.url, (item) =>
          componentDescriptors.set(`${item.id}:${item.version}`, item),
        );
      },
      {
        'aria-label': 'Component catalog',
        tooltip: 'Component catalog',
        class: 'ui-button',
        'data-tool-catalog': '',
        'data-tooltip-placement': 'right',
      },
    );
    catalogButton.append(icon(d, 'layers'));
    toolrail.append(catalogButton);
    loadCatalog(options.componentCatalog.url)
      .then(async (client) => {
        const refs = [];
        const visit = (n) => {
          if (n.type === 'component') refs.push([n.props.componentId, n.props.componentVersion]);
          n.children.forEach(visit);
        };
        visit(history.document);
        for (const [id, version] of refs.slice(0, 50)) {
          const item = await client.get(id, version);
          if (destroyed || !sessionActive) return;
          componentDescriptors.set(`${id}:${version}`, item);
        }
        if (!destroyed && sessionActive) inspect();
      })
      .catch(() => {});
  }
  function syncNavigation() {
    for (const b of toolrail.querySelectorAll('[data-tool]')) {
      const key = b.dataset.tool;
      b.setAttribute(
        'aria-pressed',
        String(
          !preview &&
            (key === 'properties'
              ? workspace.classList.contains('show-properties')
              : key === 'layers'
                ? ['layers', 'pages'].includes(tab)
                : key === toolsDialog?.key),
        ),
      );
    }
  }
  const appearanceButton = button(
    d,
    '',
    () => {
      appearance.set(appearance.value === 'light' ? 'dark' : 'light');
      updateAppearanceButton();
    },
    {
      class: 'ui-button appearance-toggle',
      'data-tool-appearance': '',
      'data-tooltip-placement': 'right',
    },
  );
  function updateAppearanceButton() {
    const next = appearance.value === 'light' ? 'dark' : 'light';
    const label = `Switch to ${next} mode`;
    appearanceButton.setAttribute('aria-label', label);
    appearanceButton.dataset.tooltip = label;
    setButtonContent(appearanceButton, '', next === 'dark' ? 'moon' : 'sun');
    tooltips.hide();
  }
  updateAppearanceButton();
  toolrail.append(appearanceButton);
  const siteSettings = button(d, '', showSetup, {
    tooltip: 'Website context and settings',
    'data-tooltip-placement': 'right',
    'aria-label': 'Website context and settings',
    class: 'ui-button rail-bottom',
  });
  siteSettings.append(icon(d, 'settings'));
  toolrail.append(siteSettings);
  function renderCanvas() {
    previewCleanup?.();
    previewCleanup = null;
    resizeObserver?.disconnect();
    const out = renderPage(history.document, data, {
      mode: preview ? 'public' : 'editor',
      baseUrl: options.baseUrl || '',
    });
    const fd = frame.contentDocument;
    if (!fd) return;
    const reset = canvasMode !== preview || !fd.querySelector('.wb-page');
    if (reset) {
      fd.open();
      fd.write(
        `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http:; media-src https: http:; style-src 'unsafe-inline'; font-src 'self' http: https:"><style>html,body{margin:0;padding:0} [data-wb-selected]{outline:2px solid ${tokens.primary};outline-offset:-2px} [data-wb-id]{cursor:default} [data-wb-field=text]:not([data-wb-connected]){cursor:text} [contenteditable=true]{outline:2px solid ${tokens.primary};outline-offset:4px;white-space:pre-wrap} [data-drop-target]{outline:3px dashed ${tokens.primary}!important}</style></head><body>${out.html}</body></html>`,
      );
      fd.close();
      canvasMode = preview;
    } else patchCanvas(fd, out.html);
    previewCleanup = enhancePage(fd.body, { media: preview, motion: preview });
    for (const n of fd.querySelectorAll('[data-wb-id]')) {
      n.setAttribute('tabindex', '0');
      n.draggable = !preview;
    }
    if (reset) {
      fd.addEventListener(
        'pointerdown',
        () => {
          deferRender = true;
        },
        true,
      );
      fd.addEventListener('pointerup', finishFocusTransfer);
      fd.addEventListener('pointercancel', finishFocusTransfer);
      fd.addEventListener('keydown', tabFocusTransfer, true);
      if (!preview) {
        for (const n of fd.querySelectorAll('[data-wb-id]')) {
          n.setAttribute('tabindex', '0');
          n.draggable = true;
        }
        fd.addEventListener('click', (e) => {
          if (e.target.closest?.('[contenteditable=true]')) return;
          const interactive = e.target.closest?.('summary,.wb-tab-list button,video');
          if (!interactive) e.preventDefault();
          const target =
            e.target.closest?.('[data-wb-linked-root]') || e.target.closest?.('[data-wb-id]');
          if (target) select(target.dataset.wbId, { focus: interactive ? 'none' : 'canvas' });
        });
        fd.addEventListener('keydown', (e) => {
          keydown(e);
          if (e.defaultPrevented) return;
          if (e.target.closest?.('.wb-tab-list button,summary,video')) return;
          const target = e.target.closest?.('[data-wb-id]');
          if (e.key === 'Enter' && target && !target.isContentEditable) {
            e.preventDefault();
            select(target.dataset.wbId);
            beginInline(target);
          }
        });
        fd.addEventListener('dblclick', (e) => {
          e.preventDefault();
          beginInline(e.target.closest?.('[data-wb-field=text]'));
        });
        fd.addEventListener('dragstart', (e) => {
          if (e.target.isContentEditable) {
            e.preventDefault();
            return;
          }
          const n = e.target.closest?.('[data-wb-id]');
          if (n) {
            dragId = n.dataset.wbId;
            e.dataTransfer?.setData('text/plain', dragId);
          }
        });
        fd.addEventListener('dragover', (e) => {
          e.preventDefault();
          const n = e.target.closest?.('[data-wb-id]');
          if (n) n.setAttribute('data-drop-target', '');
        });
        fd.addEventListener('dragleave', (e) =>
          e.target.closest?.('[data-drop-target]')?.removeAttribute('data-drop-target'),
        );
        fd.addEventListener('drop', (e) => {
          e.preventDefault();
          const n = e.target.closest?.('[data-wb-id]');
          if (n && dragId && n.dataset.wbId !== dragId) {
            try {
              command(dropOperation(history.document, dragId, n.dataset.wbId, e.shiftKey));
            } catch (err) {
              report(err.message);
            }
          }
          dragId = null;
        });
      } else
        fd.addEventListener('click', (e) => {
          const link = e.target.closest?.('a[href]');
          if (!link) return;
          e.preventDefault();
          const href = safeUrl(link.getAttribute('href'));
          if (!href) return;
          if (href.startsWith('#')) {
            let id;
            try {
              id = decodeURIComponent(href.slice(1));
            } catch {
              id = href.slice(1);
            }
            const destination = fd.getElementById(id);
            if (destination) {
              destination.tabIndex = -1;
              revealCanvasElement(destination, frame, stage, zoom);
              destination.focus({ preventScroll: true });
            } else
              report(
                'This link’s destination is not on this page. Update its link in the inspector.',
              );
          } else {
            win.open(href, '_blank', 'noopener,noreferrer');
            report('Link opened in a separate tab.', false);
          }
        });
      fd.addEventListener('click', releaseFocusTransfer);
    }
    const Observer = win.ResizeObserver;
    if (Observer) {
      resizeObserver = new Observer(() => layoutCanvas());
      resizeObserver.observe(fd.body);
    }
    for (const img of fd.querySelectorAll('img'))
      img.addEventListener('load', layoutCanvas, { once: true });
    layoutCanvas();
    renderSelection();
  }
  function beginInline(target) {
    if (
      !target?.matches?.('[data-wb-field=text]') ||
      target.dataset.wbConnected ||
      !target.dataset.wbId
    )
      return;
    flushInline();
    if (preview) return;
    select(target.dataset.wbId, { focus: 'none', reveal: false });
    const original = String(findNode(history.document, target.dataset.wbId)?.props.text || '');
    inline = { id: target.dataset.wbId, original, value: original, composing: false };
    target.contentEditable = 'true';
    target.draggable = false;
    target.focus();
    target.addEventListener('compositionstart', () => {
      if (inline) inline.composing = true;
    });
    target.addEventListener('compositionend', () => {
      if (inline) {
        inline.composing = false;
        inline.value = target.textContent;
        persistRecovery(getDocument(), save.version);
      }
    });
    target.addEventListener('input', () => {
      if (inline) {
        inline.value = target.textContent;
        if (!inline.composing) persistRecovery(getDocument(), save.version);
      }
    });
    target.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') || '';
      const selection = target.ownerDocument.getSelection();
      if (selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const n = target.ownerDocument.createTextNode(text);
        range.insertNode(n);
        range.setStartAfter(n);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } else target.textContent += text;
      if (inline) {
        inline.value = target.textContent;
        if (!inline.composing) persistRecovery(getDocument(), save.version);
      }
    });
    target.addEventListener(
      'blur',
      () => {
        if (inline?.composing) {
          inline.composing = false;
          inline.value = target.textContent;
        }
        target.contentEditable = 'false';
        flushInline();
      },
      { once: true },
    );
    target.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        inline = null;
        target.textContent = original;
        target.contentEditable = 'false';
        target.blur();
      }
    });
  }
  function render() {
    if (destroyed) return;
    if (deferRender) {
      pendingRender = true;
      return;
    }
    const areas = { inspector, rail, selectionBar };
    const focused = captureWorkspaceFocus(root, areas, frame);
    const canvasFocused =
      root.activeElement === frame
        ? frame.contentDocument?.activeElement?.closest?.('[data-wb-id]')?.dataset.wbId
        : null;
    const scrolls = [inspector, rail, stage].map((n) => [n, n.scrollTop, n.scrollLeft]);
    name.textContent = history.document.title;
    undo.disabled = !history.canUndo;
    redo.disabled = !history.canRedo;
    if (!findNode(history.document, selectedId)) selectedId = history.document.id;
    renderRail();
    inspect();
    renderCanvas();
    updateDeviceButtons();
    syncNavigation();
    toolsDialog?.update();
    restoreWorkspaceFocus(focused, areas);
    if (canvasFocused)
      canvasElement(frame, canvasFocused, history.document.id)?.focus({ preventScroll: true });
    for (const [n, top, left] of scrolls) {
      n.scrollTop = top;
      n.scrollLeft = left;
    }
  }
  function getDocument() {
    const doc = structuredClone(history.document);
    if (inline) {
      const n = findNode(doc, inline.id);
      if (n && !inline.composing) n.props.text = inline.value;
    }
    return doc;
  }
  const keydown = (e) => {
    if (e.isComposing) return;
    const dialogs = [...root.querySelectorAll('dialog[open]')];
    const editingTool = dialogs.length === 1 && dialogs[0].classList.contains('tool-dialog');
    if (dialogs.length && !editingTool) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      flushInline();
      save.flush();
      return;
    }
    if (editingTool || e.target?.closest?.('input,textarea,[contenteditable=true]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? history.redo() : history.undo();
    }
  };
  const unload = (e) => {
    if (sessionActive && (save.dirty || inline?.value !== inline?.original)) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  // A change event can fire during pointer/Tab focus transfer. Keep its target
  // alive through activation, then render once with the destination's focus.
  const releaseFocusTransfer = () => {
    win.clearTimeout(focusReleaseTimer);
    deferRender = false;
    if (pendingRender) {
      pendingRender = false;
      render();
    }
  };
  const finishFocusTransfer = () => {
    win.clearTimeout(focusReleaseTimer);
    focusReleaseTimer = win.setTimeout(releaseFocusTransfer, 0);
  };
  const pointerFocusTransfer = (e) => {
    if (e.target.closest?.('button,input,select,textarea,label')) deferRender = true;
  };
  const tabFocusTransfer = (e) => {
    if (e.key === 'Tab') {
      deferRender = true;
      finishFocusTransfer();
    }
  };
  function destroyEditor() {
    if (destroyed) return;
    destroyed = true;
    destroyHeader?.();
    componentDialog?.close();
    componentDescriptors.clear();
    requestData++;
    toolsDialog?.close({ restoreFocus: false });
    win.clearTimeout(focusReleaseTimer);
    root.removeEventListener('pointerdown', pointerFocusTransfer, true);
    root.removeEventListener('click', releaseFocusTransfer);
    root.removeEventListener('keydown', tabFocusTransfer, true);
    win.removeEventListener('pointerup', finishFocusTransfer);
    win.removeEventListener('pointercancel', finishFocusTransfer);
    win.removeEventListener('blur', finishFocusTransfer);
    cancelLibrary();
    save.destroy();
    resizeObserver?.disconnect();
    previewCleanup?.();
    tooltips.destroy();
    appearance.destroy();
    win.removeEventListener('beforeunload', unload);
    win.removeEventListener('sitebuilder:session-ended', sessionEnded);
    root.removeEventListener('keydown', keydown);
    root.replaceChildren();
  }
  const sessionEnded = () => {
    sessionActive = false;
    save.destroy();
    recovery.clear();
    unresolvedRecovery = null;
    recoveryStatus.textContent = '';
    destroyEditor();
  };
  win.addEventListener('sitebuilder:session-ended', sessionEnded);
  win.addEventListener('beforeunload', unload);
  root.addEventListener('keydown', keydown);
  root.addEventListener('pointerdown', pointerFocusTransfer, true);
  root.addEventListener('click', releaseFocusTransfer);
  root.addEventListener('keydown', tabFocusTransfer, true);
  win.addEventListener('pointerup', finishFocusTransfer);
  win.addEventListener('pointercancel', finishFocusTransfer);
  win.addEventListener('blur', finishFocusTransfer);
  frame.addEventListener(
    'load',
    () => {
      if (!destroyed) renderCanvas();
    },
    { once: true },
  );
  render();
  if (adapter.loadData && !options.data) refreshData();

  function showRecovery() {
    if (!unresolvedRecovery) return;
    openRecovery({
      root,
      entry: unresolvedRecovery,
      currentVersion: save.version,
      onRestore: (doc) => {
        if (doc.id !== history.document.id)
          throw new Error('This recovery belongs to a different page.');
        const previous = unresolvedRecovery;
        unresolvedRecovery = null;
        if (!command({ type: 'restore', document: doc })) {
          unresolvedRecovery = previous;
          throw new Error(
            'The recovered draft could not be restored. Export it to preserve your work.',
          );
        }
        recoverButton.hidden = true;
      },
      onExport: (doc) => download('recovered-website.json', doc),
      onDiscard: () => {
        unresolvedRecovery = null;
        recovery.clear();
        recoverButton.hidden = true;
        recoveryStatus.textContent = '';
        if (save.dirty) persistRecovery(getDocument(), save.version);
      },
    });
  }
  if (recovered.ok) showRecovery();
  else if (options.showSetup && !history.document.context?.setupComplete) showSetup();
  return {
    getDocument,
    get hasUnsavedChanges() {
      return sessionActive && (save.dirty || Boolean(inline && inline.value !== inline.original));
    },
    get version() {
      return save.version;
    },
    save: async () => {
      flushInline();
      await save.flush();
      if (save.error) throw save.error;
      return save.version;
    },
    update(next) {
      if (destroyed) return;
      if (next.data) data = next.data;
      if (next.document) {
        suppress = true;
        try {
          history.replace(next.document);
          save.reset(next.version ?? save.version);
        } finally {
          suppress = false;
        }
      }
      render();
    },
    select,
    command,
    undo: () => history.undo(),
    redo: () => history.redo(),
    destroy: destroyEditor,
  };
}
