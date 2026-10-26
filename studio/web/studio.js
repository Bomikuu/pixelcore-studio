import { loadingState, errorState, errorKind } from './states.js';
import { el, button, field, modal } from '../../packages/editor/src/components/ui/index.js';
import { clearRecoveryCopies } from '@sitebuilder/core';
import { createStudioClient } from './session.js';
import { mountShell } from './shell.js';
import { connectPlatform } from './platform-connect.js';
import { passwordField } from './settings.js';
export function safeReturn(value) {
  return typeof value === 'string' &&
    /^\/studio(?:\/(?:builder|settings|analytics|components))?(?:\?[^#]*)?$/.test(value)
    ? value
    : '/studio';
}
export function mountStudio(host, { fetcher = globalThis.fetch } = {}) {
  const d = host.ownerDocument,
    w = d.defaultView,
    client = createStudioClient({ fetcher, document: d }),
    controller = new AbortController();
  let alive = true,
    shell,
    view,
    session,
    connectionCleanup,
    busy = false,
    signingOut = false;
  let loading;
  const showLoading = () => {
    loading = loadingState(d, { fullscreen: true });
    (host.shadowRoot || host).replaceChildren(loading.element);
  };
  const path = w.location.pathname === '/' ? '/studio' : w.location.pathname.replace(/\/+$/, '');
  const loginHref = '/login?next=' + encodeURIComponent(safeReturn(path + w.location.search));
  function showPageError(error, options = {}) {
    const state = errorState(d, { error, onRetry: start, loginHref, ...options });
    shell.main.classList.remove('builder-main', 'lab-main-embedded');
    shell.main.replaceChildren(state.element);
    state.focus();
    return state;
  }
  const feedback = (error) => {
    if (!alive) return;
    if (view?.dialogRoot) {
      modal(
        view.dialogRoot,
        'Studio could not sign you out',
        el(d, 'p', { text: error.message || String(error) }),
        () => {},
        { confirmLabel: 'Close' },
      );
      return;
    }
    shell?.main.append(
      el(d, 'p', {
        class: 'studio-feedback error',
        role: 'alert',
        text: error.message || String(error),
      }),
    );
  };
  async function signOut() {
    const dialogRoot = view?.dialogRoot || shell.root;
    if (signingOut || dialogRoot.querySelector('dialog')) return;
    const leave = async () => {
      if (signingOut) return;
      signingOut = true;
      try {
        await client.signOut();
        view?.destroy();
        w.dispatchEvent(new w.Event('sitebuilder:session-ended'));
        try {
          clearRecoveryCopies(w.localStorage);
        } catch {}
        w.location.href = '/login';
      } finally {
        signingOut = false;
      }
    };
    if (view?.hasUnsavedChanges)
      modal(
        dialogRoot,
        'Sign out with unsaved changes?',
        el(d, 'p', {
          text: 'Your unsaved changes will be discarded and Studio recovery copies will be cleared. Save your work before signing out if you want to keep it.',
        }),
        leave,
        { confirmLabel: 'Discard and sign out', danger: true },
      );
    else
      try {
        await leave();
      } catch (error) {
        feedback(error);
      }
  }
  async function start() {
    if (!alive) return;
    connectionCleanup?.();
    view?.destroy();
    view = null;
    shell?.destroy();
    shell = null;
    showLoading();
    try {
      session = await client.session();
      if (!alive) return;
      if (session.authenticated && path === '/login') {
        w.location.replace(safeReturn(new URL(w.location.href).searchParams.get('next')));
        return;
      }
      if (
        ![
          '/studio',
          '/studio/builder',
          '/studio/settings',
          '/studio/analytics',
          '/studio/components',
          '/login',
        ].includes(path)
      ) {
        shell = mountShell(host, { session, path, onSignOut: signOut });
        showPageError(
          Object.assign(new Error('The requested Studio route was not found.'), { status: 404 }),
        );
        return;
      }
      if (!session.authenticated) {
        shell = mountShell(host, { session, path, onSignOut: signOut });
        login();
        return;
      }
      loading.update('Connecting your workspace…', 'Checking your account and available websites.');
      let workspace;
      try {
        workspace = await client.send('workspace/' + (w.location.search || ''));
      } catch (error) {
        if (!alive) return;
        shell = mountShell(host, {
          session,
          workspace: session.workspace,
          path,
          onSignOut: signOut,
        });
        const state = showPageError(error);
        if (errorKind(error) !== 'session') {
          const reconnect = el(d, 'div', { class: 'state-reconnect' });
          state.element.append(reconnect);
          platforms(reconnect, false);
        }
        return;
      }
      if (!alive) return;
      shell = mountShell(host, {
        session,
        workspace: workspace.workspace,
        path,
        onSignOut: signOut,
      });
      const pageLoading = loadingState(d, {
        title:
          path === '/studio/builder'
            ? 'Opening your website builder…'
            : path === '/studio/analytics'
              ? 'Opening analytics setup…'
              : 'Opening your workspace…',
        description: 'Getting your saved work ready.',
      });
      shell.main.replaceChildren(pageLoading.element);
      const params = new URL(w.location.href).searchParams;
      if (path === '/studio/components') {
        if (!session.capabilities.manageComponents)
          throw Object.assign(
            new Error('Component Lab is available to Studio component administrators.'),
            { status: 403 },
          );
        shell.main.replaceChildren();
        shell.main.classList.add('lab-main-embedded');
        const region = el(d, 'div');
        shell.main.append(region);
        const { mountLab } = await import('./lab.js');
        view = mountLab(region, { fetcher, embedded: true });
      } else if (path === '/studio/builder') {
        const { mountBuilder } = await import('./builder.js');
        view = await mountBuilder(shell.main, {
          client,
          workspace,
          websiteId: params.get('site'),
          mountHeader: shell.mountEditorHeader,
          onReady: () => shell.useEditorChrome(),
        });
      } else if (path === '/studio/settings') {
        const { mountSettings } = await import('./settings.js');
        view = mountSettings(shell.main, {
          client,
          session,
          appearance: shell.appearance,
          onSession: (next) => {
            session = next;
            shell.updateUser(next.user);
          },
        });
      } else if (path === '/studio/analytics') {
        const { mountAnalytics } = await import('./analytics.js');
        view = await mountAnalytics(shell.main, {
          client,
          workspace,
          websiteId: params.get('site'),
        });
      } else {
        const { mountDashboard } = await import('./dashboard.js');
        view = mountDashboard(shell.main, { client, workspace });
        const section = el(
          d,
          'section',
          { class: 'studio-form-section', id: 'studio-connections' },
          [
            el(d, 'h2', { text: 'Connected platforms' }),
            el(d, 'p', {
              class: 'muted',
              text: 'Use an existing platform account to open its business workspace.',
            }),
          ],
        );
        shell.main.append(section);
        platforms(section, false);
      }
      if (!alive) {
        view?.destroy();
        return;
      }
      const heading = shell.main.querySelector('h1');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    } catch (error) {
      if (!alive) return;
      if (!shell)
        shell = mountShell(host, {
          session: session || { authenticated: false },
          path,
          onSignOut: signOut,
        });
      showPageError(error);
    }
  }
  function platforms(region, automatic) {
    const holder = el(d, 'div', { class: 'studio-platforms' });
    region.append(holder);
    const status = el(d, 'p', { class: 'muted', role: 'status' });
    holder.append(status);
    const choices = el(d, 'div');
    holder.append(choices);
    const connect = async (platform, manual = false) => {
      if (busy) return;
      busy = true;
      status.textContent = `Checking ${platform.name}…`;
      choices.replaceChildren();
      connectionCleanup?.();
      const popupWindow = manual
        ? w.open('about:blank', 'pixelcore-studio-connect', 'width=700,height=650')
        : null;
      if (manual && !popupWindow) {
        status.textContent = 'Allow the connection window, then choose Connect again.';
        busy = false;
        return;
      }
      try {
        connectionCleanup = await connectPlatform({
          root: shell.root,
          client,
          platform,
          popupWindow,
          signal: controller.signal,
          onConnected: () => {
            const destination =
              path === '/login'
                ? new URL(w.location.href).searchParams.get('next')
                : w.location.pathname + w.location.search;
            w.location.href = safeReturn(destination);
          },
          onChoices: (items, choose) => {
            status.textContent = items.length
              ? 'Choose a business workspace.'
              : 'No editable businesses are available for this account.';
            busy = false;
            for (const item of items)
              choices.append(
                button(d, item.name, () => {
                  busy = true;
                  status.textContent = 'Connecting workspace…';
                  choose(item.id);
                }),
              );
          },
          onStatus: (text) => {
            status.textContent = text;
            busy = false;
          },
        });
      } catch (error) {
        popupWindow?.close();
        status.textContent = error.message;
        busy = false;
      }
    };
    for (const platform of session.platforms || []) {
      holder.append(
        button(
          d,
          `Connect ${platform.name}`,
          () => {
            busy = false;
            connect(platform, true);
          },
          { icon: 'shared' },
        ),
      );
      holder.append(
        el(d, 'p', {}, [
          el(d, 'a', {
            href: platform.origin + '/login',
            target: '_blank',
            rel: 'noopener',
            text: 'Sign in to ' + platform.name,
          }),
        ]),
      );
    }
    if (automatic && session.silentConnectAllowed && session.platforms?.length === 1)
      connect(session.platforms[0]);
  }
  function login() {
    const enroll = session.canEnroll,
      main = shell.main;
    const story = el(d, 'div', {}, [
      el(d, 'h1', { text: 'A home for every website you build.' }),
      el(d, 'p', {
        class: 'muted',
        text: 'Shape your next idea, connect your real business data and keep every website in one focused workspace.',
      }),
    ]);
    const form = el(d, 'form', { class: 'studio-login-form', novalidate: '' }, [
      el(d, 'h2', { text: enroll ? 'Create your Studio account.' : 'Welcome back.' }),
      el(d, 'p', {
        class: 'muted',
        text: enroll
          ? 'Set up the local administrator for this Studio.'
          : 'Sign in to Studio, or use your connected platform account.',
      }),
    ]);
    const username = field(d, 'Account name', '', () => {});
    username.querySelector('input').autocomplete = 'username';
    const pass = passwordField(d, 'Password', enroll ? 'new-password' : 'current-password');
    const status = el(d, 'p', { role: 'alert', class: 'studio-feedback error', hidden: true });
    const sign = button(
      d,
      enroll ? 'Create account' : 'Sign in',
      async (e) => {
        e.preventDefault();
        if (sign.disabled) return;
        connectionCleanup?.();
        sign.disabled = true;
        status.hidden = true;
        try {
          await client.send('session/', {
            method: 'POST',
            body: {
              username: username.querySelector('input').value,
              password: pass.input.value,
              enroll,
            },
          });
          pass.input.value = '';
          w.location.href = safeReturn(
            path === '/login'
              ? new URL(w.location.href).searchParams.get('next')
              : w.location.pathname + w.location.search,
          );
        } catch (error) {
          status.hidden = false;
          status.textContent = error.message;
          pass.input.value = '';
          pass.input.focus();
        } finally {
          if (alive) sign.disabled = false;
        }
      },
      { class: 'ui-button primary', icon: 'arrow-right', type: 'submit' },
    );
    form.append(
      username,
      pass.field,
      ...(enroll
        ? [
            el(d, 'p', {
              class: 'muted',
              text: 'Use at least 12 characters. This account manages component imports and approval.',
            }),
          ]
        : []),
      status,
      sign,
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      sign.click();
    });
    main.append(el(d, 'div', { class: 'studio-login' }, [story, form]));
    platforms(form, true);
  }
  const ready = start();
  return {
    ready,
    get session() {
      return session;
    },
    destroy() {
      alive = false;
      controller.abort();
      connectionCleanup?.();
      view?.destroy();
      shell?.destroy();
    },
  };
}
