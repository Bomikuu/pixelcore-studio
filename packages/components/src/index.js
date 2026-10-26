const own = (o, k) => Object.hasOwn(o || {}, k);
const safeKey = (k) =>
  /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(k) &&
  ![
    'constructor',
    'prototype',
    '__proto__',
    'guest',
    'guests',
    'patient',
    'patients',
    'encounter',
    'encounters',
  ].includes(k.toLowerCase());
export function componentSettings(fields = [], values = {}) {
  if (!values || typeof values !== 'object' || Array.isArray(values) || fields.length > 20)
    throw new Error('Invalid component settings.');
  const result = {};
  for (const f of fields) {
    if (!safeKey(f.key)) throw new Error('Invalid setting key.');
    const value = own(values, f.key) ? values[f.key] : f.default;
    if (f.type === 'number') {
      if (!Number.isFinite(value) || value < f.min || value > f.max)
        throw new Error(`${f.label} is outside its range.`);
    } else {
      if (typeof value !== 'string' || value.length > 2000) throw new Error(`Invalid ${f.label}.`);
      if (f.type === 'color' && !/^#[a-f\d]{6}$/i.test(value))
        throw new Error(`Choose a color for ${f.label}.`);
      if (f.type === 'select' && !f.options?.includes(value))
        throw new Error(`Choose an option for ${f.label}.`);
      if (f.type === 'image' && value && !/^https:\/\//.test(value))
        throw new Error(`Use an HTTPS image for ${f.label}.`);
    }
    result[f.key] = value;
  }
  if (Object.keys(values).some((k) => !fields.some((f) => f.key === k)))
    throw new Error('Unknown component setting.');
  return result;
}
export function publicComponentData(keys = [], data = {}) {
  const result = {};
  for (const key of keys) {
    if (!safeKey(key) || !own(data, key)) continue;
    const value = data[key];
    if (
      (typeof value === 'string' && value.length <= 4000) ||
      (typeof value === 'number' && Number.isFinite(value)) ||
      typeof value === 'boolean'
    )
      result[key] = value;
  }
  return result;
}
function safeHttp(value) {
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    !['https:', 'http:'].includes(u.protocol) ||
    (u.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))
  )
    throw new Error('Use an HTTPS component URL, or localhost for development.');
  return u;
}
export function createCatalogClient(baseUrl, fetcher = globalThis.fetch) {
  const base = safeHttp(baseUrl);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  const read = async (path) => {
    const response = await fetcher(new URL(path, base).href, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new Error('The component catalog could not load. Try again.');
    const result = await response.json();
    if (result.schemaVersion !== 1) throw new Error('Unsupported component catalog version.');
    return result;
  };
  return {
    list: async () => (await read('')).components,
    get: async (id, version) => {
      if (!/^[a-f\d-]{36}$/i.test(id) || !Number.isInteger(version) || version < 1)
        throw new Error('Invalid component reference.');
      return (await read(`${id}/${version}/`)).component;
    },
  };
}
export function mountComponent(container, descriptor, options = {}) {
  if (!descriptor?.manifest || descriptor.native)
    throw new Error('Choose an interactive component.');
  const url = safeHttp(descriptor.entryUrl);
  const d = container.ownerDocument,
    w = d.defaultView;
  const frame = d.createElement('iframe');
  frame.title = descriptor.name || descriptor.manifest.name || 'Interactive component';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.setAttribute(
    'allow',
    "camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; clipboard-read 'none'; clipboard-write 'none'",
  );
  frame.style.cssText = 'display:block;width:100%;height:100%;border:0;background:transparent';
  frame.src = url.href;
  const channel = globalThis.crypto.randomUUID();
  let destroyed = false,
    ready = false,
    visible = true,
    paused = false,
    timeout;
  let values = options.settings || {},
    data = options.publicData || {},
    theme = options.theme || {};
  componentSettings(descriptor.manifest.fields, values);
  const media = w.matchMedia?.('(prefers-reduced-motion: reduce)');
  function send() {
    if (destroyed) return;
    frame.contentWindow?.postMessage(
      {
        type: 'component:init',
        channel,
        settings: componentSettings(descriptor.manifest.fields, values),
        data: publicComponentData(descriptor.manifest.dataKeys, data),
        theme: {
          colors: Object.fromEntries(
            Object.entries(theme.colors || {}).filter(
              ([k, v]) => /^[a-zA-Z]+$/.test(k) && /^#[a-f\d]{6}$/i.test(v),
            ),
          ),
        },
        motion: !paused && !media?.matches && options.motion !== false,
        visible,
      },
      '*',
    );
  }
  const onMessage = (event) => {
    if (
      destroyed ||
      event.source !== frame.contentWindow ||
      event.origin !== 'null' ||
      event.data?.channel !== channel
    )
      return;
    if (event.data.type === 'ready') {
      ready = true;
      clearTimeout(timeout);
      options.onStatus?.('ready');
    }
    if (event.data.type === 'error' && typeof event.data.message === 'string')
      fail(event.data.message.slice(0, 500));
  };
  const onLoad = () => {
    send();
    timeout = setTimeout(() => {
      if (!ready && !destroyed) fail('Preview did not respond. Check its entry file or restart.');
    }, 12000);
  };
  frame.addEventListener('load', onLoad);
  w.addEventListener('message', onMessage);
  media?.addEventListener?.('change', send);
  const observer = w.IntersectionObserver
    ? new w.IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        send();
      })
    : null;
  const fallback = [...container.childNodes];
  container.replaceChildren(frame);
  observer?.observe(frame);
  options.onStatus?.('loading');
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    clearTimeout(timeout);
    observer?.disconnect();
    media?.removeEventListener?.('change', send);
    w.removeEventListener('message', onMessage);
    frame.removeEventListener('load', onLoad);
    if (frame.parentNode === container) container.replaceChildren(...fallback);
    frame.remove();
  }
  function fail(message) {
    destroy();
    options.onStatus?.('error', message);
  }
  return {
    frame,
    update(next = {}) {
      values = next.settings ?? values;
      data = next.publicData ?? data;
      theme = next.theme ?? theme;
      componentSettings(descriptor.manifest.fields, values);
      send();
    },
    pause(value = true) {
      paused = value;
      send();
    },
    destroy,
  };
}
export async function enhanceComponents(
  root,
  { catalogUrl, publicData = {}, theme = {}, onError, signal } = {},
) {
  const nodes = [...root.querySelectorAll('[data-component-id]')];
  if (!nodes.length) return () => {};
  if (!catalogUrl) throw new Error('Configure an optional component catalog URL.');
  const client = createCatalogClient(catalogUrl, (url, options) =>
      globalThis.fetch(url, { ...options, signal }),
    ),
    mounted = [],
    cache = new Map();
  let closed = Boolean(signal?.aborted);
  const cleanup = () => {
    closed = true;
    mounted.forEach((runtime) => runtime.destroy());
    signal?.removeEventListener('abort', cleanup);
  };
  signal?.addEventListener('abort', cleanup, { once: true });
  for (const target of nodes) {
    if (closed) break;
    try {
      const id = target.dataset.componentId,
        version = Number(target.dataset.componentVersion),
        key = `${id}:${version}`;
      if (!cache.has(key)) cache.set(key, client.get(id, version));
      const descriptor = await cache.get(key);
      if (!closed && target.isConnected)
        mounted.push(
          mountComponent(target, descriptor, {
            settings: JSON.parse(target.dataset.componentSettings || '{}'),
            publicData,
            theme,
            onStatus: (state, message) => {
              if (state === 'error') onError?.(message);
            },
          }),
        );
    } catch (error) {
      if (!closed) onError?.(error.message);
    }
  }
  return cleanup;
}
