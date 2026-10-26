// Store only a time-bounded visitor preference, scoped to a public business identity.
export function consentKey(scope) {
  return 'pixelcore:analytics-consent:v1:' + encodeURIComponent(String(scope));
}
export function createConsentStore({ scope, storage, eventTarget, now = () => Date.now() }) {
  if (!scope) throw new Error('A public business scope is required.');
  const key = consentKey(scope),
    listeners = new Set();
  let value = 'unset';
  const read = () => {
    try {
      const row = JSON.parse(storage?.getItem(key) || 'null');
      return row && row.expires > now() && ['allowed', 'denied'].includes(row.value)
        ? row.value
        : 'unset';
    } catch {
      return 'unset';
    }
  };
  const update = () => {
    value = read();
    for (const listener of listeners) listener(value);
  };
  value = read();
  const changed = (event) => {
    if (event.key === key || event.key === null) update();
  };
  eventTarget?.addEventListener('storage', changed);
  return {
    get value() {
      return value;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next) {
      if (!['allowed', 'denied'].includes(next)) throw new Error('Choose allow or decline.');
      value = next;
      try {
        storage?.setItem(key, JSON.stringify({ value: next, expires: now() + 180 * 86400000 }));
      } catch {}
      for (const listener of listeners) listener(value);
    },
    destroy() {
      eventTarget?.removeEventListener('storage', changed);
      listeners.clear();
    },
  };
}
