import { el, button } from '../../packages/editor/src/components/ui/index.js';
export function avatarNode(d, user) {
  const initials = (user.displayName || user.username || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
  const node = el(d, 'span', { class: 'studio-avatar', 'aria-hidden': 'true', text: initials });
  if (user.avatarUrl) {
    const image = el(d, 'img', { src: user.avatarUrl, alt: '', width: 30, height: 30 });
    image.addEventListener('error', () => node.replaceChildren(d.createTextNode(initials)), {
      once: true,
    });
    node.replaceChildren(image);
  }
  return node;
}
export function createAccountMenu(d, user, onSignOut, { compact = false } = {}) {
  const details = el(d, 'details', { class: 'studio-account-menu' + (compact ? ' compact' : '') }),
    summary = el(d, 'summary', { 'aria-label': 'Account menu' }, [
      avatarNode(d, user),
      el(d, 'span', { class: 'studio-account-name', text: user.displayName }),
    ]);
  details.append(
    summary,
    el(d, 'div', { class: 'studio-menu' }, [
      el(d, 'strong', { text: user.displayName }),
      el(d, 'p', {
        class: 'muted',
        text: `${user.source === 'studio' ? 'Studio account' : user.source + ' account'}${user.email ? ' · ' + user.email : ''}`,
      }),
      el(d, 'a', { href: '/studio', text: 'Dashboard' }),
      el(d, 'a', { href: '/studio/settings', text: 'Account settings' }),
      button(d, 'Sign out of Studio', onSignOut, { icon: 'back' }),
    ]),
  );
  details.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      details.open = false;
      summary.focus();
    }
  });
  return details;
}
export const accountCss = `
.studio-avatar{width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;border-radius:50%;background:var(--editor-selected);color:var(--editor-focus);font-size:11px;font-weight:700;overflow:hidden}.studio-avatar img{width:100%;height:100%;object-fit:cover}.studio-account-menu{position:relative}.studio-account-menu summary{display:flex;align-items:center;gap:9px;cursor:pointer;font-size:12px;list-style:none;padding:6px;border-radius:6px}.studio-account-menu summary::-webkit-details-marker{display:none}.studio-account-menu summary:hover{background:var(--editor-selected)}.studio-account-menu summary:focus-visible{outline:2px solid var(--editor-focus);outline-offset:3px}.studio-account-menu.compact .studio-account-name{display:none}.studio-menu{position:absolute;right:0;top:46px;width:240px;max-width:calc(100vw - 24px);z-index:40;background:var(--editor-surface);border:1px solid var(--editor-controlBorder);border-radius:12px;padding:18px;box-shadow:0 12px 32px #0002}.studio-menu p{font-size:11px;line-height:1.6;overflow-wrap:anywhere;color:var(--editor-muted);margin:8px 0 16px}.studio-menu strong{font-size:12px}.studio-menu a{display:block;margin:14px 0;font-size:12px;color:var(--editor-text);text-underline-offset:4px}.studio-menu .ui-button{width:100%;margin-top:6px}.editor-header-extension{display:flex;align-items:center;flex-shrink:0;margin-left:4px}.topbar:has(.editor-header-extension){gap:12px}.topbar:has(.editor-header-extension)>.toolbar{margin-left:auto}
`;
