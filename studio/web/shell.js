import {
  el,
  button,
  createTooltipProvider,
} from '../../packages/editor/src/components/ui/index.js';
import { icon } from '../../packages/editor/src/components/ui/icons.js';
import { editorCss } from '../../packages/editor/src/workspace/styles.js';
import { createAppearance } from '../../packages/editor/src/workspace/appearance.js';
import { fontCss } from '@sitebuilder/renderer';
import { shellCss } from './styles-shell.js';
import { createAccountMenu, accountCss } from './account.js';
export { avatarNode } from './account.js';
export function brand(d) {
  return el(
    d,
    'a',
    { href: '/studio', class: 'studio-brand', 'aria-label': 'Pixelcore Studio home' },
    [
      el(d, 'img', {
        src: '/packages/editor/src/assets/pixelcore-studio-icon.webp',
        alt: '',
        width: 36,
        height: 36,
      }),
      el(d, 'span', { class: 'studio-wordmark' }, [
        el(d, 'strong', { text: 'Pixelcore' }),
        el(d, 'small', { text: 'Studio' }),
      ]),
    ],
  );
}
export function actionLink(d, label, href, { secondary = false, glyph } = {}) {
  return el(d, 'a', { href, class: 'studio-action' + (secondary ? ' secondary' : '') }, [
    glyph ? icon(d, glyph) : null,
    el(d, 'span', { text: label }),
  ]);
}
export function mountShell(host, { session, workspace, onSignOut, path = '/studio' }) {
  const d = host.ownerDocument,
    root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  root.replaceChildren(el(d, 'style', { text: editorCss + '\n' + shellCss + '\n' + accountCss }));
  if (!d.head.querySelector('[data-studio-fonts]'))
    d.head.append(el(d, 'style', { 'data-studio-fonts': '', text: fontCss }));
  let storage;
  try {
    storage = d.defaultView.localStorage;
  } catch {}
  const appearance = createAppearance(host, { storage }),
    tooltips = createTooltipProvider(root);
  const embeddedLab = path === '/studio/components';
  const shell = el(d, 'div', { class: 'studio-shell' }),
    header = el(d, 'header', { class: 'studio-header' }),
    main = el(d, embeddedLab ? 'div' : 'main', { class: 'studio-main', id: 'studio-main' }),
    account = el(d, 'div', { class: 'studio-account' });
  header.append(brand(d));
  if (workspace)
    header.append(
      el(d, 'div', { class: 'studio-context', text: workspace.name }, [
        el(d, 'span', { text: workspace.sample ? 'Local samples' : workspace.source }),
      ]),
    );
  const nav = [
    ['Overview', '/studio', 'templates'],
    ['Website builder', '/studio/builder', 'edit'],
    ['Analytics setup', '/studio/analytics', 'data'],
    ...(session.capabilities?.manageComponents
      ? [['Component Lab', '/studio/components', 'layers']]
      : []),
    ['Settings', '/studio/settings', 'settings'],
  ];
  const sidebar = el(
    d,
    'nav',
    { class: 'studio-sidebar', id: 'studio-navigation', 'aria-label': 'Workspace navigation' },
    [el(d, 'p', { class: 'studio-nav-label', text: 'Workspace' })],
  );
  let menuOpen = false;
  const navigationToggle = button(d, '', () => setMenu(!menuOpen), {
    class: 'ui-button icon-button studio-menu-toggle',
    'aria-label': 'Open navigation',
    'aria-expanded': 'false',
    'aria-controls': 'studio-navigation',
    icon: 'menu',
  });
  function setMenu(open) {
    menuOpen = open;
    shell.dataset.navigationOpen = String(open);
    navigationToggle.setAttribute('aria-expanded', String(open));
    navigationToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  }
  if (session.authenticated) {
    for (const [label, href, glyph] of nav)
      sidebar.append(
        el(d, 'a', { href, ...(href === path ? { 'aria-current': 'page' } : {}) }, [
          icon(d, glyph),
          el(d, 'span', { text: label }),
        ]),
      );
    header.prepend(navigationToggle);
  }
  const dismissNavigation = (event) => {
    if (event.key === 'Escape' && menuOpen) {
      setMenu(false);
      navigationToggle.focus();
    }
  };
  const outsideNavigation = (event) => {
    if (menuOpen && !sidebar.contains(event.target) && !navigationToggle.contains(event.target))
      setMenu(false);
  };
  root.addEventListener('keydown', dismissNavigation);
  root.addEventListener('click', outsideNavigation);
  const theme = button(
    d,
    '',
    () => {
      appearance.set(appearance.value === 'light' ? 'dark' : 'light');
      updateTheme();
    },
    { class: 'ui-button icon-button' },
  );
  function updateTheme() {
    theme.replaceChildren(icon(d, appearance.value === 'light' ? 'moon' : 'sun'));
    theme.setAttribute(
      'aria-label',
      appearance.value === 'light' ? 'Switch to dark mode' : 'Switch to light mode',
    );
    theme.dataset.tooltip = theme.getAttribute('aria-label');
  }
  updateTheme();
  account.append(theme);
  function updateUser(user) {
    account.querySelector('details')?.remove();
    if (!user) return;
    const details = createAccountMenu(d, user, onSignOut);
    account.append(details);
  }
  updateUser(session.user);
  header.append(account);
  if (session.authenticated) {
    shell.append(header, sidebar, main);
  } else {
    shell.style.gridTemplateColumns = '1fr';
    shell.append(header, main);
    main.style.padding = '0';
  }
  root.append(shell);
  return {
    root,
    main,
    appearance,
    updateUser,
    useEditorChrome() {
      header.remove();
      sidebar.remove();
      shell.classList.add('studio-editor-shell');
    },
    mountEditorHeader(container, { root: editorRoot }) {
      const style = el(d, 'style', { text: accountCss });
      editorRoot.append(style);
      const menu = createAccountMenu(d, session.user, onSignOut, { compact: true });
      container.append(menu);
      return () => {
        menu.remove();
        style.remove();
      };
    },
    destroy() {
      root.removeEventListener('keydown', dismissNavigation);
      root.removeEventListener('click', outsideNavigation);
      tooltips.destroy();
      appearance.destroy();
      root.replaceChildren();
    },
  };
}
