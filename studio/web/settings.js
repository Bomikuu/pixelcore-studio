import { el, button, field, filePicker } from '../../packages/editor/src/components/ui/index.js';
import { avatarNode } from './shell.js';
import { passwordField } from '../../packages/editor/src/components/ui/index.js';
export { passwordField } from '../../packages/editor/src/components/ui/index.js';
export function mountSettings(region, { client, session, onSession, appearance }) {
  const d = region.ownerDocument,
    w = d.defaultView;
  const dirty = new Set();
  let busy = false,
    alive = true,
    file;
  const status = el(d, 'p', { class: 'studio-feedback', role: 'status', hidden: true });
  const message = (text, error = false) => {
    if (!alive) return;
    status.textContent = text;
    status.hidden = false;
    status.classList.toggle('error', error);
    status.setAttribute('role', error ? 'alert' : 'status');
  };
  const run = async (control, fn) => {
    if (busy) return;
    busy = true;
    const controls = [...region.querySelectorAll('button,input,select')].map((c) => [
      c,
      c.disabled,
    ]);
    controls.forEach(([c]) => (c.disabled = true));
    try {
      await fn();
    } catch (error) {
      message(error.message, true);
    } finally {
      busy = false;
      if (alive) controls.forEach(([c, was]) => (c.disabled = was));
    }
  };
  region.replaceChildren(
    el(d, 'div', { class: 'studio-intro' }, [
      el(d, 'div', {}, [
        el(d, 'h1', { text: 'Make Studio feel like yours.' }),
        el(d, 'p', {
          class: 'muted',
          text: 'Manage your profile, appearance and sign-in preferences.',
        }),
      ]),
    ]),
    status,
  );
  const form = el(d, 'div', { class: 'studio-form' }),
    help = el(d, 'aside', { class: 'studio-help' }, [
      el(d, 'h2', { text: 'Your account, your workspace.' }),
      el(d, 'p', {
        text:
          session.user.source === 'studio'
            ? 'Your Studio profile is shared across the dashboard, editor and Component Lab. Your website branding is managed separately in the builder.'
            : 'Your platform remains the source of your identity and business permissions. Studio uses that account without duplicating it.',
      }),
    ]);
  if (session.user.source !== 'studio') {
    form.append(
      el(d, 'section', { class: 'studio-form-section' }, [
        el(d, 'h2', { text: 'Profile' }),
        avatarNode(d, session.user),
        el(d, 'p', { text: session.user.displayName }),
        el(d, 'p', { class: 'muted', text: session.user.email }),
        el(d, 'a', {
          href: session.user.settingsUrl,
          target: '_blank',
          rel: 'noopener',
          class: 'studio-action secondary',
          text: 'Manage platform account',
        }),
      ]),
    );
  } else {
    const name = field(d, 'Display name', session.user.displayName, () => {}),
      email = field(d, 'Email address', session.user.email, () => {}, { type: 'email' });
    name.querySelector('input').autocomplete = 'name';
    email.querySelector('input').autocomplete = 'email';
    const avatar = el(d, 'div', { class: 'studio-avatar-edit' }, [avatarNode(d, session.user)]);
    const upload = filePicker(
      d,
      'Profile image',
      (value) => {
        file = value;
      },
      { accept: 'image/jpeg,image/png,image/webp' },
    );
    const uploadButton = button(
      d,
      'Upload image',
      (e) =>
        run(e.currentTarget, async () => {
          if (!file) throw new Error('Choose a JPEG, PNG or WebP image first.');
          const data = new FormData();
          data.append('file', file);
          const result = await client.send('profile/avatar/', { method: 'POST', form: data });
          if (!alive) return;
          onSession(result);
          avatar.replaceChildren(avatarNode(d, result.user));
          message('Profile image updated.');
        }),
      { icon: 'upload' },
    );
    const remove = button(d, 'Remove image', (e) =>
      run(e.currentTarget, async () => {
        const result = await client.send('profile/avatar/', { method: 'DELETE' });
        if (!alive) return;
        onSession(result);
        avatar.replaceChildren(avatarNode(d, result.user));
        message('Profile image removed.');
      }),
    );
    const save = button(
      d,
      'Save profile',
      (e) => {
        e.preventDefault();
        return run(e.currentTarget, async () => {
          const result = await client.send('profile/', {
            method: 'PATCH',
            body: {
              displayName: name.querySelector('input').value,
              email: email.querySelector('input').value,
            },
          });
          if (!alive) return;
          dirty.delete('profile');
          onSession(result);
          message('Your profile is saved.');
        });
      },
      { class: 'ui-button primary', icon: 'save', type: 'submit' },
    );
    const profile = el(d, 'form', { class: 'studio-form-section', novalidate: '' }, [
      el(d, 'h2', { text: 'Profile' }),
      avatar,
      upload,
      el(d, 'p', { class: 'muted', text: 'JPEG, PNG or WebP. Up to 2 MB and 4096 × 4096 pixels.' }),
      el(d, 'div', { class: 'studio-actions' }, [uploadButton, remove]),
      name,
      email,
      save,
    ]);
    profile.addEventListener('input', () => {
      dirty.add('profile');
    });
    profile.addEventListener('submit', (e) => {
      e.preventDefault();
      save.click();
    });
    form.append(profile);
    const current = passwordField(d, 'Current password', 'current-password'),
      next = passwordField(d, 'New password', 'new-password');
    next.input.minLength = 12;
    const change = button(
      d,
      'Update password',
      (e) => {
        e.preventDefault();
        return run(e.currentTarget, async () => {
          await client.send('profile/password/', {
            method: 'POST',
            body: { currentPassword: current.input.value, newPassword: next.input.value },
          });
          current.input.value = '';
          next.input.value = '';
          dirty.delete('security');
          message('Your password is updated. You are still signed in.');
        });
      },
      { icon: 'check', type: 'submit' },
    );
    const security = el(d, 'form', { class: 'studio-form-section', novalidate: '' }, [
      el(d, 'h2', { text: 'Security' }),
      el(d, 'p', {
        class: 'muted',
        text: 'Use at least 12 characters. Password managers and pasted passwords are supported.',
      }),
      current.field,
      next.field,
      change,
    ]);
    security.addEventListener('input', () => {
      dirty.add('security');
    });
    security.addEventListener('submit', (e) => {
      e.preventDefault();
      change.click();
    });
    form.append(security);
  }
  form.append(
    el(d, 'section', { class: 'studio-form-section' }, [
      el(d, 'h2', { text: 'Appearance' }),
      el(d, 'p', {
        class: 'muted',
        text: 'Choose how the Studio workspace looks. Website colors stay in Theme & branding.',
      }),
      field(d, 'Workspace appearance', appearance.value, (v) => appearance.set(v), {
        options: [
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ],
      }),
    ]),
  );
  region.append(el(d, 'div', { class: 'studio-form-layout' }, [form, help]));
  const unload = (e) => {
    if (dirty.size) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  w.addEventListener('beforeunload', unload);
  return {
    get hasUnsavedChanges() {
      return dirty.size > 0;
    },
    destroy() {
      alive = false;
      w.removeEventListener('beforeunload', unload);
      region.replaceChildren();
    },
  };
}
