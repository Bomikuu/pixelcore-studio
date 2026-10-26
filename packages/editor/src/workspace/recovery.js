import { normalizeGlobalFonts, templateDocument, recoveryPrefix } from '@sitebuilder/core';
import { button, el } from '../components/ui/index.js';

const WEEK = 7 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 550000;
const validKey = (value) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
const bytes = (value) => new TextEncoder().encode(value).length;
function recoveryDocument(document) {
  // The template validator rejects unknown/executable fields. Preserve only validated page context.
  templateDocument(document);
  return normalizeGlobalFonts(document);
}

/** Storage is opt-in: scope must be issued by the host for its current user and tenant. */
export function createRecoveryStore({
  storage,
  scope,
  websiteId,
  now = Date.now,
  ttl = WEEK,
} = {}) {
  const enabled = validKey(scope) && validKey(websiteId) && Number.isFinite(ttl) && ttl > 0;
  const key = enabled
    ? `${recoveryPrefix}${encodeURIComponent(scope)}:${encodeURIComponent(websiteId)}`
    : '';
  const unavailable = () => ({
    ok: false,
    reason: enabled ? 'storage-unavailable' : 'scope-required',
  });
  return {
    key,
    read() {
      if (!enabled) return unavailable();
      let raw;
      try {
        raw = storage.getItem(key);
      } catch {
        return unavailable();
      }
      if (raw == null) return { ok: false, reason: 'missing' };
      if (typeof raw !== 'string' || bytes(raw) > MAX_BYTES)
        return { ok: false, reason: 'oversize' };
      try {
        const entry = JSON.parse(raw);
        if (entry?.scope !== scope || entry?.websiteId !== websiteId)
          return { ok: false, reason: 'scope-mismatch' };
        if (
          entry.version !== 1 ||
          Object.keys(entry).some(
            (k) =>
              !['version', 'scope', 'websiteId', 'savedAt', 'baseVersion', 'document'].includes(k),
          ) ||
          !Number.isSafeInteger(entry.baseVersion) ||
          entry.baseVersion < 0 ||
          !Number.isFinite(entry.savedAt)
        )
          return { ok: false, reason: 'corrupt' };
        const age = now() - entry.savedAt;
        if (age < -60000) return { ok: false, reason: 'corrupt' };
        if (age >= ttl) return { ok: false, reason: 'expired' };
        entry.document = recoveryDocument(entry.document);
        return { ok: true, entry };
      } catch {
        return { ok: false, reason: 'corrupt' };
      }
    },
    write(document, baseVersion) {
      if (!enabled) return unavailable();
      if (!Number.isSafeInteger(baseVersion) || baseVersion < 0)
        return { ok: false, reason: 'invalid-version' };
      let entry, raw;
      try {
        entry = {
          version: 1,
          scope,
          websiteId,
          savedAt: now(),
          baseVersion,
          document: recoveryDocument(document),
        };
        raw = JSON.stringify(entry);
      } catch {
        return { ok: false, reason: 'invalid-document' };
      }
      if (bytes(raw) > MAX_BYTES) return { ok: false, reason: 'oversize' };
      try {
        storage.setItem(key, raw);
      } catch {
        return unavailable();
      }
      return { ok: true, entry };
    },
    clear() {
      if (!enabled) return unavailable();
      try {
        storage.removeItem(key);
        return { ok: true };
      } catch {
        return unavailable();
      }
    },
  };
}

export function openRecovery({ root, entry, currentVersion, onRestore, onExport, onDiscard }) {
  const d = root.ownerDocument,
    previous = root.activeElement;
  const dialog = el(d, 'dialog', { class: 'ui-dialog', 'aria-label': 'Recover unsaved work' });
  const error = el(d, 'p', { class: 'error', role: 'alert' });
  const actions = el(d, 'div', { class: 'dialog-actions' });
  const matches = entry.baseVersion === currentVersion;
  let closed = false,
    pending = false;
  const close = () => {
    if (closed) return;
    closed = true;
    dialog.close?.();
    dialog.remove();
    previous?.focus?.();
  };
  const run = async (operation, closeAfter) => {
    if (closed || pending) return;
    pending = true;
    error.textContent = '';
    for (const control of actions.querySelectorAll('button')) control.disabled = true;
    try {
      await operation();
      if (!closed && closeAfter) close();
    } catch (cause) {
      if (!closed)
        error.textContent =
          cause?.message || 'This action failed. Your recovery copy is still available. Try again.';
    } finally {
      pending = false;
      if (!closed)
        for (const control of actions.querySelectorAll('button')) control.disabled = false;
    }
  };
  const savedAt = new Date(entry.savedAt);
  dialog.append(
    el(d, 'h2', { text: 'Recover unsaved work' }),
    el(d, 'p', {
      text: `An unsaved copy of “${entry.document.title}” is available${Number.isNaN(savedAt.valueOf()) ? '.' : ` from ${savedAt.toLocaleString()}.`}`,
    }),
    el(d, 'p', {
      class: 'muted',
      text: matches
        ? 'Restore it as an editable draft. Your live website stays unchanged, and you can undo the restoration.'
        : 'The server draft has changed since this copy was saved. Export this copy to keep your work, or discard it. It cannot replace the newer draft.',
    }),
    error,
    actions,
  );
  actions.append(button(d, 'Decide later', close));
  if (onExport)
    actions.append(
      button(d, 'Export recovery JSON', () =>
        run(() => onExport(structuredClone(entry.document), entry), false),
      ),
    );
  if (onDiscard)
    actions.append(button(d, 'Discard recovery', () => run(() => onDiscard(entry), true)));
  if (matches && onRestore)
    actions.append(
      button(
        d,
        'Restore draft',
        () => run(() => onRestore(structuredClone(entry.document), entry), true),
        { class: 'ui-button primary' },
      ),
    );
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  root.append(dialog);
  if (dialog.showModal) dialog.showModal();
  else dialog.setAttribute('open', '');
  actions.firstElementChild?.focus();
  return { close, element: dialog };
}
