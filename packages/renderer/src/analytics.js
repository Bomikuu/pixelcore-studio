import { validateAnalytics } from '@sitebuilder/core';
const installations = new WeakMap();
const privatePath = (path) =>
  /^\/(studio(?:[/-]|$)|workspace(?:\/|$)|login(?:\/|$)|website-review(?:\/|$)|event\/[^/]+\/rsvp(?:\/|$))/.test(
    path,
  );
const referrerOrigin = (d) => {
  try {
    const url = new URL(d.referrer);
    return /^https?:$/.test(url.protocol) ? url.origin : '';
  } catch {
    return '';
  }
};
export function enhanceAnalytics(root, value, { consent = false, mode = 'public' } = {}) {
  if (!root || mode !== 'public' || consent !== true) return () => {};
  const config = validateAnalytics(value),
    d = root.ownerDocument || root,
    w = d.defaultView;
  if (config.provider === 'none' || !w || privatePath(w.location.pathname)) return () => {};
  const hostname = w.location.hostname.toLowerCase();
  if (hostname !== config.domain && !hostname.endsWith('.' + config.domain)) return () => {};
  const key = JSON.stringify(config);
  let registry = installations.get(d);
  if (!registry) {
    registry = new Map();
    installations.set(d, registry);
  }
  let entry = registry.get(key);
  if (!entry) {
    entry = { count: 0, ready: false, script: d.createElement('script') };
    registry.set(key, entry);
    entry.script.async = true;
    entry.script.setAttribute('data-website-analytics', config.provider);
    entry.script.referrerPolicy = 'strict-origin-when-cross-origin';
    if (config.provider === 'google') {
      w.dataLayer = w.dataLayer || [];
      const gtag = function () {
        w.dataLayer.push(arguments);
      };
      entry.track = () => {
        if (entry.count > 0 && !privatePath(w.location.pathname)) {
          w['ga-disable-' + config.measurementId] = false;
          gtag('consent', 'update', { analytics_storage: 'granted' });
          gtag('config', config.measurementId, {
            send_page_view: false,
            page_location: w.location.origin + w.location.pathname,
            page_referrer: referrerOrigin(d),
          });
          gtag('event', 'page_view', {
            send_to: config.measurementId,
            page_location: w.location.origin + w.location.pathname,
            page_referrer: referrerOrigin(d),
          });
        }
      };
      gtag('consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'granted',
      });
      gtag('js', new Date());
      entry.script.src =
        'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(config.measurementId);
    } else {
      const plausible = function () {
        (plausible.q = plausible.q || []).push(arguments);
      };
      plausible.o = {
        autoCapturePageviews: false,
        outboundLinks: false,
        fileDownloads: false,
        formSubmissions: false,
        transformRequest: (payload) =>
          entry.count > 0 && !privatePath(w.location.pathname)
            ? { ...payload, u: w.location.origin + w.location.pathname, r: referrerOrigin(d) }
            : null,
      };
      w.plausible = plausible;
      entry.track = () => {
        if (entry.count > 0 && !privatePath(w.location.pathname))
          plausible('pageview', { url: w.location.origin + w.location.pathname });
      };
      entry.script.src = config.scriptUrl;
      entry.script.setAttribute('data-domain', config.domain);
    }
    entry.script.addEventListener(
      'load',
      () => {
        entry.ready = true;
        entry.track();
      },
      { once: true },
    );
    d.head.append(entry.script);
  }
  entry.count++;
  if (entry.ready && entry.count === 1) entry.track();
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    entry.count = Math.max(0, entry.count - 1);
    if (entry.count === 0 && config.provider === 'google') {
      w['ga-disable-' + config.measurementId] = true;
      if (![...registry.values()].some((value) => value !== entry && value.count > 0))
        w.dataLayer.push(['consent', 'update', { analytics_storage: 'denied' }]);
    }
  };
}
