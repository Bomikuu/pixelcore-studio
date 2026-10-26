import { loadingState, errorState } from './states.js';
import {
  el,
  button,
  field,
  filePicker,
  createTooltipProvider,
  passwordField,
} from '../../packages/editor/src/components/ui/index.js';
import { icon } from '../../packages/editor/src/components/ui/icons.js';
import { editorCss } from '../../packages/editor/src/workspace/styles.js';
import { createAppearance } from '../../packages/editor/src/workspace/appearance.js';
import { renderPage, fontCss } from '@sitebuilder/renderer';
import { createDocument, schemes } from '@sitebuilder/core';
import { mountComponent, componentSettings, publicComponentData } from '@sitebuilder/components';
import { labCss } from './styles.js';

export function mountLab(host, { fetcher = globalThis.fetch, embedded = false } = {}) {
  const d = host.ownerDocument,
    w = d.defaultView,
    root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  root.replaceChildren(el(d, 'style', { text: editorCss + '\n' + labCss }));
  let storage;
  try {
    storage = w.localStorage;
  } catch {}
  const appearance = createAppearance(host, { storage }),
    tooltips = createTooltipProvider(root);
  if (fontCss) d.head.append(el(d, 'style', { 'data-lab-fonts': '', text: fontCss }));
  const state = {
    session: null,
    items: [],
    filter: 'all',
    query: '',
    category: 'all',
    limit: 12,
    mode: 'loading',
    selected: null,
    versions: [],
    tab: 'settings',
    manifest: null,
    values: {},
    data: {},
    device: 'desktop',
    dark: false,
    paused: false,
    busy: false,
    file: null,
    context: {},
    dirty: false,
  };
  let destroyed = false,
    request = 0,
    runtime = null,
    resize = null,
    previewFrame = null;
  const shell = el(d, 'div', { class: 'lab-shell' }),
    top = el(d, 'header', { class: 'lab-topbar' }),
    main = el(d, 'main', { class: 'lab-main' }),
    feedback = el(d, 'p', { class: 'lab-feedback', role: 'status', hidden: true });
  const lockup = el(
    d,
    'a',
    { class: 'lab-brand', href: '/', 'aria-label': 'Pixelcore Studio website builder' },
    [
      el(d, 'img', {
        src: '/packages/editor/src/assets/pixelcore-studio-icon.webp',
        alt: '',
        width: 36,
        height: 36,
      }),
      el(d, 'span', { class: 'lab-wordmark' }, [
        el(d, 'span', { class: 'lab-wordmark-name', text: 'Pixelcore' }),
        el(d, 'span', { class: 'lab-wordmark-label', text: 'Studio' }),
      ]),
    ],
  );
  const nav = el(d, 'nav', { 'aria-label': 'Studio navigation' }, [
    el(d, 'a', { href: '/', text: 'Website builder' }),
    el(d, 'a', { href: '/studio/components', text: 'Component Lab', 'aria-current': 'page' }),
  ]);
  const account = el(d, 'div', { class: 'lab-account' });
  const themeButton = button(
    d,
    '',
    () => {
      appearance.set(appearance.value === 'dark' ? 'light' : 'dark');
      updateThemeButton();
    },
    { class: 'ui-button icon-button' },
  );
  function updateThemeButton() {
    const dark = host.dataset.editorAppearance === 'dark';
    themeButton.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    themeButton.dataset.tooltip = themeButton.getAttribute('aria-label');
    themeButton.replaceChildren(icon(d, dark ? 'sun' : 'moon'));
  }
  updateThemeButton();
  top.append(lockup, nav, account, themeButton);
  shell.append(top, feedback, main);
  root.append(shell);
  if (embedded) {
    top.remove();
    root.append(
      el(d, 'style', {
        text: ':host{min-height:0}.lab-shell{min-height:calc(100dvh - 64px)}.lab-topbar[hidden]{display:none}',
      }),
    );
  }
  function message(text, error = false) {
    if (destroyed) return;
    feedback.textContent = text;
    feedback.hidden = !text;
    feedback.classList.toggle('error', error);
    feedback.setAttribute('role', error ? 'alert' : 'status');
  }
  function stopPreview() {
    runtime?.destroy();
    runtime = null;
    resize?.disconnect();
    resize = null;
    previewFrame?.remove();
    previewFrame = null;
  }
  function headingFocus() {
    const h = main.querySelector('h1');
    if (h) {
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    }
  }
  async function send(path, { method = 'GET', body, form } = {}) {
    const token =
      d.cookie
        .split('; ')
        .find((v) => v.startsWith('studio_csrftoken='))
        ?.split('=')
        .slice(1)
        .join('=') || '';
    const response = await fetcher('/api/studio/' + path, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(!['GET', 'HEAD'].includes(method) ? { 'X-CSRFToken': decodeURIComponent(token) } : {}),
      },
      ...(form ? { body: form } : body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(json.error?.message || 'The request could not complete. Try again.'),
        { status: response.status },
      );
    return json;
  }
  function action(label, run, attrs = {}) {
    return button(
      d,
      label,
      async () => {
        if (state.busy) return;
        state.busy = true;
        const controls = [...root.querySelectorAll('[data-write],input,select,textarea')].map(
          (c) => [c, c.disabled],
        );
        controls.forEach(([c]) => (c.disabled = true));
        try {
          await run();
        } catch (e) {
          if (!destroyed) message(e.message, true);
        } finally {
          state.busy = false;
          if (!destroyed)
            controls.forEach(([c, wasDisabled]) => {
              if (c.isConnected) c.disabled = wasDisabled;
            });
        }
      },
      { 'data-write': '', ...attrs },
    );
  }
  function draftGuard(run) {
    if (state.busy) return;
    const invoke = () =>
      Promise.resolve()
        .then(run)
        .catch((error) => message(error.message, true));
    if (!state.dirty) return invoke();
    const dialog = el(
      d,
      'dialog',
      { class: 'ui-dialog lab-discard', 'aria-label': 'Discard unsaved defaults?' },
      [
        el(d, 'h2', { text: 'Discard unsaved defaults?' }),
        el(d, 'p', {
          text: 'Your uploaded package stays in the library. Changes to its defaults have not been saved.',
        }),
      ],
    );
    const cancel = button(d, 'Keep editing', () => {
      dialog.close?.();
      dialog.remove();
    });
    dialog.append(
      el(d, 'div', { class: 'dialog-actions' }, [
        cancel,
        button(
          d,
          'Discard changes',
          () => {
            state.dirty = false;
            dialog.close?.();
            dialog.remove();
            invoke();
          },
          { class: 'ui-button danger' },
        ),
      ]),
    );
    root.append(dialog);
    dialog.addEventListener('cancel', () => dialog.remove());
    dialog.showModal?.();
    if (!dialog.open) dialog.setAttribute('open', '');
    cancel.focus();
  }
  function renderAccount() {
    account.replaceChildren();
    if (state.session?.authenticated)
      account.append(
        el(d, 'span', { class: 'muted', text: state.session.username }),
        button(
          d,
          'Sign out',
          () =>
            draftGuard(async () => {
              await send('session/', { method: 'DELETE' });
              state.session = null;
              state.mode = 'loading';
              stopPreview();
              await load();
            }),
          { class: 'ui-button quiet-action' },
        ),
      );
  }
  async function load() {
    if (!state.dirty)
      main.replaceChildren(
        loadingState(d, {
          title: 'Opening Component Lab…',
          description: 'Loading your approved components and saved imports.',
        }).element,
      );
    const seq = ++request;
    try {
      const session = await send('session/');
      if (destroyed || seq !== request) return;
      state.session = session;
      renderAccount();
      if (!session.authenticated) {
        renderLogin();
        return;
      }
      const result = await send('components/');
      if (destroyed || seq !== request) return;
      state.items = result.components;
      const id = new URL(w.location.href).searchParams.get('component');
      if (id && state.items.some((c) => c.id === id))
        await openComponent(
          id,
          Number(new URL(w.location.href).searchParams.get('version')) || undefined,
        );
      else renderLibrary();
    } catch (e) {
      if (destroyed) return;
      const error = errorState(d, { error: e, onRetry: load });
      main.replaceChildren(error.element);
      error.focus();
    }
  }
  function renderLogin() {
    stopPreview();
    state.mode = 'login';
    main.replaceChildren();
    const enroll = state.session.canEnroll;
    const form = el(d, 'form', { class: 'lab-access-form' }, [
      el(d, 'h1', { text: enroll ? 'Make this Studio yours.' : 'Welcome back.' }),
      el(d, 'p', {
        class: 'muted',
        text: enroll
          ? 'Create the local administrator account for your component library.'
          : 'Sign in to import, preview and manage your reusable components.',
      }),
    ]);
    let username = '',
      password = '';
    const user = field(d, 'Account name', '', (v) => (username = v));
    user.querySelector('input').autocomplete = 'username';
    const pass = passwordField(d, 'Password', enroll ? 'new-password' : 'current-password').field;
    pass.querySelector('input').autocomplete = enroll ? 'new-password' : 'current-password';
    pass.querySelector('input').minLength = 12;
    form.append(user, pass);
    if (enroll)
      form.append(
        el(d, 'p', {
          class: 'muted',
          text: 'Use at least 12 characters. This account manages imports and catalog approval.',
        }),
      );
    const sign = action(
      enroll ? 'Create Studio account' : 'Sign in',
      async () => {
        username = user.querySelector('input').value;
        password = pass.querySelector('input').value;
        await send('session/', { method: 'POST', body: { username, password, enroll } });
        password = '';
        pass.querySelector('input').value = '';
        await load();
      },
      { class: 'ui-button primary', icon: 'arrow-right' },
    );
    form.append(sign);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      sign.click();
    });
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
        sign.click();
      }
    });
    main.append(
      el(d, 'div', { class: 'lab-access' }, [
        el(d, 'div', { class: 'lab-access-story' }, [
          el(d, 'div', { class: 'lab-orbit', 'aria-hidden': 'true' }, [icon(d, 'layers')]),
          el(d, 'h2', { text: 'A new home for your next idea.' }),
          el(d, 'p', {
            text: 'Bring in a section. Make it yours. Share it across the websites you build.',
          }),
          el(d, 'a', { href: '/', text: 'Back to website builder', class: 'lab-text-link' }),
        ]),
        form,
      ]),
    );
  }
  function intro(title, description, actions = []) {
    return el(d, 'div', { class: 'lab-heading' }, [
      el(d, 'div', {}, [
        el(d, 'h1', { text: title }),
        el(d, 'p', { class: 'muted', text: description }),
      ]),
      el(d, 'div', { class: 'lab-heading-actions' }, actions),
    ]);
  }
  function downloadLink(label, href) {
    return el(d, 'a', { href, class: 'lab-text-link', text: label });
  }
  function renderLibrary() {
    stopPreview();
    state.mode = 'library';
    state.selected = null;
    state.dirty = false;
    w.history.replaceState({}, '', '/studio/components');
    main.replaceChildren(
      intro('Component Lab', 'A place for the sections and interactions you want to use again.', [
        downloadLink('Download Three.js starter', '/api/studio/starter/'),
        button(d, 'Import component', () => renderImport(), {
          class: 'ui-button primary',
          icon: 'upload',
        }),
      ]),
    );
    const toolbar = el(d, 'div', { class: 'lab-library-toolbar' });
    const search = field(
      d,
      'Find a component',
      state.query,
      (v) => {
        state.query = v;
        state.limit = 12;
        draw();
      },
      { type: 'search' },
    );
    search.querySelector('input').placeholder = 'Search names, descriptions or tags';
    search.querySelector('input').addEventListener('input', (e) => {
      state.query = e.target.value;
      state.limit = 12;
      draw();
    });
    const filters = el(d, 'div', {
      class: 'lab-filters',
      role: 'group',
      'aria-label': 'Component status',
    });
    for (const [key, label] of [
      ['all', 'All components'],
      ['approved', 'In catalog'],
      ['draft', 'Drafts'],
    ])
      filters.append(
        button(
          d,
          label,
          () => {
            state.filter = key;
            for (const b of filters.children)
              b.setAttribute('aria-pressed', b.dataset.filter === key);
            draw();
          },
          { 'data-filter': key, 'aria-pressed': state.filter === key },
        ),
      );
    toolbar.append(search, filters);
    const content = el(d, 'div');
    main.append(toolbar, content);
    function draw() {
      content.replaceChildren();
      const items = state.items.filter(
        (c) =>
          (state.filter === 'all' ||
            (state.filter === 'approved'
              ? c.currentApproved !== null
              : c.version !== c.currentApproved)) &&
          [c.name, c.manifest.description, ...c.manifest.tags]
            .join(' ')
            .toLowerCase()
            .includes(state.query.toLowerCase()),
      );
      if (!state.items.length) {
        content.append(
          el(d, 'div', { class: 'lab-empty-layout' }, [
            el(d, 'section', { class: 'lab-empty-import' }, [
              icon(d, 'upload'),
              el(d, 'h2', { text: 'Bring something great into your library.' }),
              el(d, 'p', {
                class: 'muted',
                text: 'Upload a browser-ready ZIP or a builder JSON section. Preview it, set the editable options and choose when it joins your catalog.',
              }),
              button(d, 'Choose a package', () => renderImport(), {
                class: 'ui-button primary',
                icon: 'add',
              }),
              el(d, 'p', {
                class: 'muted',
                text: 'HTML · CSS · JavaScript · Three.js · Builder JSON',
              }),
            ]),
            el(d, 'aside', { class: 'lab-starter' }, [
              el(d, 'div', { class: 'lab-starter-art', 'aria-hidden': 'true' }, [
                icon(d, 'layers'),
              ]),
              el(d, 'h2', { text: 'Start with an orbit.' }),
              el(d, 'p', {
                class: 'muted',
                text: 'A working Three.js banner with color and speed controls, ready for your first import.',
              }),
              downloadLink('Download starter ZIP', '/api/studio/starter/'),
              el(d, 'p', {
                class: 'muted',
                text: 'The library stays empty until you import a component.',
              }),
            ]),
          ]),
        );
        return;
      }
      if (!items.length) {
        content.append(
          el(d, 'section', { class: 'lab-empty' }, [
            el(d, 'h2', { text: 'No matching components' }),
            el(d, 'p', { class: 'muted', text: 'Try another name or switch the status filter.' }),
          ]),
        );
        return;
      }
      const grid = el(d, 'div', { class: 'lab-component-grid' });
      for (const item of items.slice(0, state.limit)) {
        const thumb = el(d, 'span', {
          class: `lab-card-preview lab-card-${item.manifest.kind}`,
          'aria-hidden': 'true',
        });
        if (item.posterUrl)
          thumb.append(
            el(d, 'img', { src: item.posterUrl, alt: '', loading: 'lazy', decoding: 'async' }),
          );
        else thumb.append(icon(d, item.native ? 'layers' : 'preview'));
        const choose = button(d, item.name, () => openComponent(item.id), {
          class: 'ui-button lab-component-card',
          'aria-label': `Open ${item.name}`,
        });
        choose.prepend(thumb);
        choose.append(
          el(d, 'span', {
            class: 'lab-card-description',
            text: item.manifest.description || `${item.manifest.kind} · ${item.manifest.usage}`,
          }),
          el(d, 'span', { class: 'lab-card-meta' }, [
            el(d, 'span', {
              class: item.currentApproved ? 'lab-badge' : 'muted',
              text: item.currentApproved ? `Catalog v${item.currentApproved}` : 'Draft',
            }),
            el(d, 'span', {
              class: 'muted',
              text: `v${item.version} · ${item.native ? 'Builder JSON' : 'Interactive'}`,
            }),
          ]),
        );
        grid.append(choose);
      }
      content.append(grid);
      if (items.length > state.limit)
        content.append(
          button(d, 'Show more', () => {
            state.limit += 12;
            draw();
          }),
        );
    }
    draw();
    headingFocus();
  }
  function renderImport() {
    stopPreview();
    state.mode = 'import';
    state.file = null;
    state.context = {};
    state.dirty = false;
    main.replaceChildren();
    main.append(
      button(d, 'Back to library', () => draftGuard(renderLibrary), { icon: 'back' }),
      intro(
        'Bring a component into Studio.',
        'Choose a package, add context and see how it behaves before adding it to the catalog.',
      ),
    );
    const form = el(d, 'div', { class: 'lab-import-form' }),
      fileState = el(d, 'p', { class: 'muted', text: 'ZIP or builder JSON · up to 20 MB' });
    const picker = filePicker(
      d,
      'Component package',
      (file) => {
        state.file = file;
        fileState.textContent = file
          ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB`
          : 'Choose a ZIP or JSON file.';
        state.dirty = Boolean(file);
      },
      { accept: '.zip,.json,application/zip,application/json' },
    );
    form.append(
      el(d, 'section', { class: 'lab-upload-panel' }, [
        icon(d, 'upload'),
        el(d, 'h2', { text: 'Choose your files.' }),
        el(d, 'p', {
          class: 'muted',
          text: 'ZIP packages include component.json, an HTML entry and the assets it uses. Builder JSON imports as editable sections.',
        }),
        picker,
        fileState,
        downloadLink('Download a working ZIP package', '/api/studio/starter/'),
      ]),
    );
    const context = el(d, 'section', { class: 'lab-import-context' }, [
      el(d, 'h2', { text: 'A little context.' }),
      el(d, 'p', {
        class: 'muted',
        text: 'These details help you find the right component later. Keep the package defaults where they already fit.',
      }),
    ]);
    context.append(
      field(d, 'Name (optional)', '', (v) => (state.context.name = v)),
      field(d, 'What are you importing?', '', (v) => (state.context.kind = v), {
        options: [
          { value: '', label: 'Use package setting' },
          'section',
          'component',
          'background',
        ],
      }),
      field(d, 'Where will you use it?', '', (v) => (state.context.usage = v), {
        options: [
          { value: '', label: 'Use package setting' },
          'landing',
          'storefront',
          'event',
          'general',
        ],
      }),
      field(d, 'Source link (optional)', '', (v) => (state.context.sourceUrl = v)),
    );
    const upload = action(
      'Upload and preview',
      async () => {
        if (!state.file) throw new Error('Choose a ZIP package or builder JSON file first.');
        const data = new w.FormData();
        data.append('file', state.file);
        const override = Object.fromEntries(Object.entries(state.context).filter(([, v]) => v));
        if (Object.keys(override).length) {
          override.schemaVersion = 1;
          data.append('manifest', JSON.stringify(override));
        }
        const result = await send('components/', { method: 'POST', form: data });
        state.items.unshift(result.component);
        state.dirty = false;
        await openComponent(result.component.id);
        message('Draft imported. Preview it before adding it to the catalog.');
      },
      { class: 'ui-button primary', icon: 'upload' },
    );
    context.append(upload);
    form.append(context);
    main.append(form);
    headingFocus();
  }
  async function openComponent(id, number) {
    const seq = ++request;
    message('');
    main.replaceChildren(
      loadingState(d, {
        title: 'Loading your component…',
        description: 'Preparing its saved versions and preview settings.',
      }).element,
    );
    try {
      const result = await send(`components/${id}/`);
      if (destroyed || seq !== request) return;
      state.versions = result.versions;
      const latest = result.versions[0];
      state.items = state.items.map((item) => (item.id === id ? latest : item));
      chooseVersion(number || result.versions[0].version);
      message('');
    } catch (e) {
      if (!destroyed && seq === request) {
        const error = errorState(d, { error: e, onRetry: () => openComponent(id, number) });
        error.element
          .querySelector('.state-actions')
          .append(button(d, 'Back to library', renderLibrary));
        main.replaceChildren(error.element);
        error.focus();
      }
    }
  }
  function chooseVersion(number) {
    stopPreview();
    state.selected = state.versions.find((v) => v.version === number);
    if (!state.selected) return;
    state.manifest = structuredClone(state.selected.manifest);
    state.values = componentSettings(state.manifest.fields, {});
    state.data = {};
    state.dirty = false;
    state.mode = 'detail';
    w.history.replaceState(
      {},
      '',
      '/studio/components?component=' + state.selected.id + '&version=' + number,
    );
    renderDetail();
  }
  function syncPreview() {
    if (runtime)
      try {
        runtime.update({
          settings: state.values,
          publicData: state.data,
          theme: { colors: (state.dark ? schemes[1] : schemes[0]).colors },
        });
      } catch (e) {
        message(e.message, true);
      }
  }
  function renderDetail() {
    stopPreview();
    main.replaceChildren();
    const selected = state.selected;
    const latest = state.versions[0].version === selected.version;
    const back = button(d, 'Back to library', () => draftGuard(renderLibrary), { icon: 'back' });
    main.append(back);
    const save = action(
      'Save defaults',
      async () => {
        if (!latest) throw new Error('Choose the latest version to change its defaults.');
        const m = structuredClone(state.manifest);
        m.fields = m.fields.map((f) => ({ ...f, default: state.values[f.key] }));
        const result = await send(`components/${selected.id}/`, {
          method: 'PUT',
          body: { expectedVersion: selected.version, manifest: m },
        });
        state.dirty = false;
        await openComponent(selected.id, result.component.version);
        message('New draft version saved. The catalog keeps its approved version.');
      },
      { class: 'ui-button', icon: 'save', disabled: !latest },
    );
    const approve = action(
      selected.currentApproved === selected.version ? 'In catalog' : 'Add to catalog',
      async () => {
        if (state.dirty)
          throw new Error('Save your defaults before adding this version to the catalog.');
        const result = await send(`components/${selected.id}/approve/`, {
          method: 'POST',
          body: { version: selected.version, expectedApproved: selected.currentApproved },
        });
        state.dirty = false;
        await refreshItems();
        await openComponent(selected.id, result.component.version);
        message(`Version ${selected.version} is now available in the component catalog.`);
      },
      {
        class: 'ui-button primary',
        icon: 'check',
        disabled: selected.currentApproved === selected.version,
      },
    );
    main.append(
      intro(
        selected.name,
        `${selected.native ? 'Editable builder section' : 'Interactive ' + selected.manifest.kind} · Version ${selected.version} · ${selected.currentApproved === selected.version ? 'In catalog' : 'Draft preview'}`,
        [save, approve],
      ),
    );
    const workspace = el(d, 'div', { class: 'lab-workspace' }),
      preview = el(d, 'section', { class: 'lab-preview', 'aria-label': 'Component preview' }),
      controls = el(d, 'div', { class: 'lab-preview-controls' }),
      devices = el(d, 'div', { class: 'device-controls', 'aria-label': 'Preview viewport' });
    for (const [key, label] of [
      ['desktop', 'Desktop'],
      ['tablet', 'Tablet'],
      ['phone', 'Phone'],
    ])
      devices.append(
        button(
          d,
          '',
          () => {
            state.device = key;
            startPreview();
            for (const b of devices.children)
              b.setAttribute('aria-pressed', b.dataset.device === key);
          },
          {
            'data-device': key,
            'aria-label': label,
            tooltip: label,
            'aria-pressed': state.device === key,
            icon: key,
          },
        ),
      );
    const background = button(
      d,
      '',
      () => {
        state.dark = !state.dark;
        startPreview();
        background.setAttribute('aria-pressed', String(state.dark));
      },
      {
        icon: 'theme',
        class: 'ui-button icon-button',
        'aria-label': 'Toggle preview theme',
        tooltip: 'Toggle preview theme',
        'aria-pressed': state.dark,
      },
    );
    const pause = button(
      d,
      'Pause',
      () => {
        state.paused = !state.paused;
        runtime?.pause(state.paused);
        pause.querySelector('.button-label').textContent = state.paused ? 'Resume' : 'Pause';
        pause.setAttribute('aria-pressed', String(state.paused));
      },
      { 'aria-pressed': state.paused, disabled: Boolean(selected.native) },
    );
    const restart = action(
      'Restart',
      async () => {
        const result = await send(`components/${selected.id}/`);
        if (destroyed) return;
        const fresh = result.versions.find((v) => v.version === selected.version);
        if (fresh) {
          selected.entryUrl = fresh.entryUrl;
          selected.posterUrl = fresh.posterUrl;
        }
        startPreview();
      },
      { icon: 'refresh' },
    );
    controls.append(devices, background, pause, restart);
    const stage = el(d, 'div', { class: 'lab-preview-stage' }),
      viewport = el(d, 'div', { class: 'lab-preview-viewport' }),
      target = el(d, 'div', { class: 'lab-preview-target' }),
      status = el(d, 'p', {
        class: 'lab-preview-status',
        role: 'status',
        text: 'Preparing preview…',
      });
    viewport.append(target);
    stage.append(viewport);
    preview.append(
      controls,
      stage,
      status,
      el(d, 'p', {
        class: 'lab-preview-meta muted',
        text: `${selected.fileCount} files · ${(selected.byteSize / 1024).toFixed(0)} KB · ${selected.native ? 'Native section' : 'Isolated interactive preview'}`,
      }),
    );
    const inspector = el(d, 'aside', {
        class: 'lab-config',
        'aria-label': 'Component configuration',
      }),
      tabs = el(d, 'nav', { class: 'lab-config-tabs', 'aria-label': 'Configuration views' }),
      body = el(d, 'div', { class: 'lab-config-body' });
    for (const [key, label] of [
      ['settings', 'Settings'],
      ['details', 'Details'],
      ['versions', 'Versions'],
    ])
      tabs.append(
        button(
          d,
          label,
          () => {
            state.tab = key;
            drawConfig();
            for (const b of tabs.children) b.setAttribute('aria-pressed', b.dataset.tab === key);
          },
          { 'data-tab': key, 'aria-pressed': state.tab === key },
        ),
      );
    inspector.append(tabs, body);
    workspace.append(preview, inspector);
    main.append(workspace);
    function startPreview() {
      stopPreview();
      target.replaceChildren();
      const theme = (state.dark ? schemes[1] : schemes[0]).colors;
      target.style.background = theme.background;
      const width = { desktop: 1100, tablet: 768, phone: 390 }[state.device],
        height = state.manifest.height;
      target.style.width = width + 'px';
      target.style.height = height + 'px';
      function reflow() {
        const available = stage.clientWidth ? stage.clientWidth - 40 : width;
        const scale = Math.min(1, Math.max(0.1, available / width));
        target.style.transform = `scale(${scale})`;
        viewport.style.width = width * scale + 'px';
        viewport.style.height = height * scale + 'px';
      }
      reflow();
      if (w.ResizeObserver) {
        resize = new w.ResizeObserver(reflow);
        resize.observe(stage);
      }
      if (selected.native) {
        const doc = structuredClone(selected.native);
        doc.theme.colors = theme;
        previewFrame = el(d, 'iframe', {
          title: 'Native section preview',
          sandbox: '',
          referrerpolicy: 'no-referrer',
          srcdoc: renderPage(doc).html,
        });
        target.append(previewFrame);
        status.textContent = 'Ready · Native builder section';
      } else {
        const fallback = el(d, 'div', { class: 'lab-preview-fallback' });
        if (selected.posterUrl)
          fallback.append(
            el(d, 'img', {
              src: selected.posterUrl,
              alt: state.manifest.fallbackText || selected.name,
            }),
          );
        else
          fallback.append(
            el(d, 'p', {
              text: state.manifest.fallbackText || 'Your component preview will appear here.',
            }),
          );
        target.append(fallback);
        runtime = mountComponent(
          target,
          { ...selected, manifest: state.manifest },
          {
            settings: state.values,
            publicData: state.data,
            theme: { colors: theme },
            onStatus: (value, error) => {
              status.textContent =
                value === 'ready'
                  ? 'Ready · Interactive preview'
                  : value === 'loading'
                    ? 'Loading component…'
                    : error;
              status.classList.toggle('error', value === 'error');
            },
          },
        );
        runtime.pause(state.paused);
      }
    }
    function changed() {
      state.dirty = true;
      syncPreview();
    }
    function drawConfig() {
      body.replaceChildren();
      if (state.tab === 'settings') {
        body.append(
          el(d, 'h2', { text: 'Make it yours.' }),
          el(d, 'p', {
            class: 'muted',
            text: latest
              ? 'Change the preview, then save the defaults as a new version.'
              : 'An earlier version. Select the latest version to edit its defaults.',
          }),
        );
        if (!state.manifest.fields.length)
          body.append(
            el(d, 'p', {
              class: 'muted',
              text: 'This package has no editable settings. Add fields to component.json and upload a new version.',
            }),
          );
        for (const f of state.manifest.fields)
          body.append(
            field(
              d,
              f.label,
              state.values[f.key],
              (v) => {
                state.values[f.key] = v;
                changed();
              },
              {
                type: f.type === 'number' ? 'number' : f.type === 'color' ? 'color' : 'text',
                options: f.type === 'select' ? f.options : undefined,
                min: f.min,
                max: f.max,
                readonly: !latest,
              },
            ),
          );
        const advanced = el(d, 'details', { class: 'lab-advanced' }, [
          el(d, 'summary', { text: 'Preview inputs' }),
          el(d, 'p', {
            class: 'muted',
            text: state.manifest.dataKeys.length
              ? `Declared public inputs: ${state.manifest.dataKeys.join(', ')}. Changes here are for preview only.`
              : 'This component declares no live-data inputs.',
          }),
        ]);
        if (state.manifest.dataKeys.length)
          advanced.append(
            field(
              d,
              'Public preview data',
              JSON.stringify(state.data, null, 2),
              (v) => {
                try {
                  const parsed = JSON.parse(v);
                  state.data = publicComponentData(state.manifest.dataKeys, parsed);
                  syncPreview();
                  message('Preview data updated.');
                } catch {
                  message('Enter valid JSON for the declared public inputs.', true);
                }
              },
              { type: 'textarea' },
            ),
          );
        body.append(advanced);
      } else if (state.tab === 'details') {
        body.append(el(d, 'h2', { text: 'Component details' }));
        for (const [key, label, type] of [
          ['name', 'Name', 'text'],
          ['description', 'Description', 'textarea'],
          ['sourceUrl', 'Source link', 'text'],
          ['author', 'Author', 'text'],
          ['license', 'License / attribution notes', 'textarea'],
          ['fallbackText', 'Fallback text', 'text'],
          ['height', 'Preview height', 'number'],
        ])
          body.append(
            field(
              d,
              label,
              state.manifest[key],
              (v) => {
                state.manifest[key] = v;
                state.dirty = true;
              },
              {
                type,
                min: key === 'height' ? 120 : undefined,
                max: key === 'height' ? 1200 : undefined,
                readonly: !latest,
              },
            ),
          );
        for (const [key, label, options] of [
          ['kind', 'Component type', ['section', 'component', 'background']],
          ['usage', 'Usage', ['landing', 'storefront', 'event', 'general']],
        ])
          body.append(
            field(
              d,
              label,
              state.manifest[key],
              (v) => {
                state.manifest[key] = v;
                state.dirty = true;
              },
              { options, readonly: !latest },
            ),
          );
        const images = selected.files.filter((f) => /\.(png|jpe?g|webp|avif)$/i.test(f));
        body.append(
          field(
            d,
            'Poster image',
            state.manifest.poster,
            (v) => {
              state.manifest.poster = v;
              state.dirty = true;
            },
            { options: [{ value: '', label: 'No poster' }, ...images], readonly: !latest },
          ),
          el(d, 'p', {
            class: 'muted',
            text: state.manifest.networkOrigins.length
              ? `Resource origins: ${state.manifest.networkOrigins.join(', ')}`
              : 'This package uses only its uploaded assets.',
          }),
          downloadLink(
            'Export this version',
            `/api/studio/components/${selected.id}/export/${selected.version}/`,
          ),
        );
      } else {
        body.append(
          el(d, 'h2', { text: 'Version history' }),
          el(d, 'p', {
            class: 'muted',
            text: 'Choose a version to preview it. Add an earlier version to the catalog to roll back future insertions; existing pages keep their pinned version.',
          }),
        );
        for (const v of state.versions)
          body.append(
            button(
              d,
              `Version ${v.version}${v.currentApproved === v.version ? ' · In catalog' : v.approved ? ' · Previously approved' : ' · Draft'}`,
              () => draftGuard(() => chooseVersion(v.version)),
              { 'aria-pressed': v.version === selected.version, class: 'ui-button lab-version' },
            ),
          );
        let file = null;
        body.append(
          filePicker(d, 'New package version', (v) => (file = v), { accept: '.zip,.json' }),
          action(
            'Upload new version',
            async () => {
              if (!file) throw new Error('Choose a ZIP or JSON package.');
              const data = new w.FormData();
              data.append('file', file);
              data.append('expectedVersion', String(state.versions[0].version));
              const result = await send(`components/${selected.id}/`, {
                method: 'POST',
                form: data,
              });
              state.dirty = false;
              await refreshItems();
              await openComponent(selected.id, result.component.version);
              message('New package version uploaded.');
            },
            { icon: 'upload' },
          ),
        );
      }
    }
    drawConfig();
    startPreview();
    headingFocus();
  }
  async function refreshItems() {
    const result = await send('components/');
    if (!destroyed) state.items = result.components;
  }
  const beforeUnload = (e) => {
    if (state.dirty || state.busy) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  w.addEventListener('beforeunload', beforeUnload);
  const navGuard = (e) => {
    const a = e.composedPath().find((n) => n?.tagName === 'A');
    if (a && state.dirty && !a.href.includes('/api/studio/')) {
      e.preventDefault();
      draftGuard(() => w.location.assign(a.href));
    }
  };
  root.addEventListener('click', navGuard);
  const saveShortcut = (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === 's' &&
      state.mode === 'detail'
    ) {
      event.preventDefault();
      [...root.querySelectorAll('button')].find((b) => b.textContent === 'Save defaults')?.click();
    }
  };
  root.addEventListener('keydown', saveShortcut);
  main.append(
    loadingState(d, {
      title: 'Opening Component Lab…',
      description: 'Loading your saved components.',
    }).element,
  );
  load();
  return {
    root,
    state,
    get hasUnsavedChanges() {
      return state.dirty;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      request++;
      stopPreview();
      appearance.destroy();
      tooltips.destroy();
      w.removeEventListener('beforeunload', beforeUnload);
      root.removeEventListener('click', navGuard);
      root.removeEventListener('keydown', saveShortcut);
      root.replaceChildren();
    },
    reload: load,
  };
}
