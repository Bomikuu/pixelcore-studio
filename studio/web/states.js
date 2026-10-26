import { tokenCss } from '../../packages/editor/src/tokens.js';
import { el, button } from '../../packages/editor/src/components/ui/index.js';
const stylesheet = '/studio/web/states.css';
function initialTokens(d) {
  let appearance = 'light';
  try {
    if (d.defaultView.localStorage.getItem('sitebuilder:appearance:v1') === 'dark')
      appearance = 'dark';
  } catch {}
  return tokenCss(appearance);
}
export function stateStyles(d) {
  return el(d, 'link', { rel: 'stylesheet', href: stylesheet });
}
export function loadingSpinner(d, { staticSpinner = false } = {}) {
  return el(d, 'div', {
    class: 'state-spinner' + (staticSpinner ? ' is-static' : ''),
    'aria-hidden': 'true',
  });
}
export function loadingState(
  d,
  {
    title = 'Opening Pixelcore Studio…',
    description = 'Preparing your workspace.',
    fullscreen = false,
    compact = false,
  } = {},
) {
  const heading = el(d, 'p', { class: 'state-title', text: title }),
    detail = el(d, 'p', { class: 'state-description', text: description });
  const element = el(
    d,
    'section',
    {
      class: 'studio-state' + (fullscreen ? ' fullscreen' : '') + (compact ? ' compact' : ''),
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
      'aria-busy': 'true',
      ...(fullscreen ? { style: initialTokens(d) } : {}),
    },
    [stateStyles(d), loadingSpinner(d), el(d, 'div', { class: 'state-copy' }, [heading, detail])],
  );
  return {
    element,
    update(title, description) {
      heading.textContent = title;
      if (description !== undefined) detail.textContent = description;
    },
  };
}
export function errorKind(error, { online = true } = {}) {
  if (error?.status === 401) return 'session';
  if (error?.status === 403) return 'access';
  if (error?.status === 404) return 'missing';
  if (
    !online ||
    (error instanceof TypeError &&
      /fetch|network|load failed|connection|offline/i.test(error.message)) ||
    error?.name === 'NetworkError'
  )
    return 'offline';
  return 'unavailable';
}
const messages = {
  session: {
    title: 'Sign in to continue',
    description: 'Your Studio session has ended. Sign in again to return to your workspace.',
  },
  access: {
    title: 'This workspace needs permission',
    description:
      'Your account does not have access to this page. Choose an authorized workspace or check your account with its administrator.',
  },
  missing: {
    title: 'This page isn’t here',
    description:
      'The link may be out of date, or this website may have been removed. Return to your dashboard to find your work.',
  },
  offline: {
    title: 'Let’s reconnect',
    description: 'Studio could not reach your workspace. Check your connection, then try again.',
  },
  unavailable: {
    title: 'Studio couldn’t open this page',
    description: 'Something interrupted the request. Try again, or return to your dashboard.',
  },
};
export function errorState(
  d,
  {
    error,
    kind = errorKind(error, { online: d.defaultView.navigator.onLine !== false }),
    title,
    description,
    onRetry,
    fullscreen = false,
    loginHref = '/login',
    dashboardHref = '/studio',
  } = {},
) {
  const copy = messages[kind] || messages.unavailable,
    id = 'state-heading-' + globalThis.crypto.randomUUID();
  const image = el(d, 'img', {
      class: 'state-illustration',
      src: '/studio/web/assets/state-placeholder.svg',
      alt: '',
      width: 256,
      height: 176,
      decoding: 'async',
    }),
    fallback = loadingSpinner(d, { staticSpinner: true });
  fallback.hidden = true;
  image.addEventListener(
    'error',
    () => {
      image.hidden = true;
      fallback.hidden = false;
    },
    { once: true },
  );
  const actions = el(d, 'div', { class: 'state-actions' }),
    retryError = el(d, 'p', { class: 'state-action-error', role: 'alert', hidden: true });
  const element = el(
    d,
    'section',
    {
      class: 'studio-state' + (fullscreen ? ' fullscreen' : ''),
      'aria-labelledby': id,
      ...(fullscreen ? { style: initialTokens(d) } : {}),
    },
    [
      stateStyles(d),
      image,
      fallback,
      el(d, 'div', { class: 'state-copy', role: 'alert' }, [
        el(d, 'h1', { class: 'state-title', id, text: title || copy.title, tabindex: '-1' }),
        el(d, 'p', { class: 'state-description', text: description || copy.description }),
      ]),
      actions,
      retryError,
    ],
  );
  if (onRetry && !['session', 'access', 'missing'].includes(kind)) {
    let busy = false;
    const retry = button(
      d,
      'Try again',
      async () => {
        if (busy) return;
        busy = true;
        retry.disabled = true;
        retryError.hidden = true;
        try {
          await onRetry();
        } catch (cause) {
          if (element.isConnected) {
            retryError.textContent = cause.message || 'Still unable to connect. Try again.';
            retryError.hidden = false;
          }
        } finally {
          busy = false;
          if (element.isConnected) retry.disabled = false;
        }
      },
      { class: 'ui-button primary', icon: 'refresh' },
    );
    actions.append(retry);
  }
  if (kind === 'session')
    actions.append(el(d, 'a', { href: loginHref, text: 'Sign in', class: 'state-link primary' }));
  actions.append(
    el(d, 'a', {
      href: dashboardHref,
      text: 'Back to dashboard',
      class: 'state-link' + (['missing', 'access'].includes(kind) ? ' primary' : ''),
    }),
  );
  if (kind === 'access')
    actions.append(
      el(d, 'a', { href: '/studio/settings', text: 'Account settings', class: 'state-link' }),
    );
  if (error?.message) {
    element.append(
      el(d, 'details', { class: 'state-details' }, [
        el(d, 'summary', { text: 'Error details' }),
        el(d, 'p', { text: error.message }),
      ]),
    );
  }
  return {
    element,
    focus() {
      element.querySelector('h1').focus({ preventScroll: true });
    },
  };
}
