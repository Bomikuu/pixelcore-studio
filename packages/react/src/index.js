'use client';
import { createElement, useEffect, useRef } from 'react';
import { renderPage, enhancePage, enhanceAnalytics } from '@sitebuilder/renderer';
export function WebsitePage({
  document,
  data = {},
  mode = 'public',
  baseUrl = '',
  widgets = {},
  landmark = true,
  componentCatalog,
  componentData = {},
  analyticsConsent = false,
}) {
  const host = useRef(null);
  useEffect(() => {
    if (mode !== 'public' || !host.current) return;
    const dispose = enhancePage(host.current),
      mounted = [];
    const analyticsCleanup = enhanceAnalytics(host.current, document.analytics, {
      consent: analyticsConsent,
      mode,
    });
    const controller = new AbortController();
    let componentCleanup;
    if (componentCatalog?.url && host.current.querySelector('[data-component-id]')) {
      const target = host.current;
      import('@sitebuilder/components')
        .then(({ enhanceComponents }) =>
          enhanceComponents(target, {
            catalogUrl: componentCatalog.url,
            publicData: componentData,
            theme: document.theme,
            signal: controller.signal,
          }),
        )
        .then((dispose) => {
          if (controller.signal.aborted) dispose();
          else componentCleanup = dispose;
        })
        .catch(() => {});
    }
    for (const marker of host.current.querySelectorAll('[data-wb-widget]')) {
      const mount = widgets[marker.dataset.wbWidget];
      if (mount)
        mounted.push(mount(marker, { nodeId: marker.dataset.wbId || marker.dataset.wbPart }));
    }
    return () => {
      controller.abort();
      componentCleanup?.();
      mounted.forEach((fn) => fn?.());
      dispose();
      analyticsCleanup();
    };
  }, [document, data, mode, baseUrl, widgets, componentCatalog, componentData, analyticsConsent]);
  return createElement('div', {
    ref: host,
    'data-website-host': 'react',
    dangerouslySetInnerHTML: {
      __html: renderPage(document, data, { mode, baseUrl, landmark }).html,
    },
  });
}
export function WebsiteEditor({
  document,
  data = {},
  adapter,
  version = 0,
  appearance,
  componentCatalog,
  enableFreeform = false,
  showSetup = false,
  onChange,
  onReady,
  onError,
}) {
  const host = useRef(null),
    instance = useRef(null),
    callbacks = useRef({ onChange, onReady, onError }),
    latest = useRef({
      document,
      data,
      adapter,
      version,
      appearance,
      componentCatalog,
      enableFreeform,
      showSetup,
    });
  latest.current = {
    document,
    data,
    adapter,
    version,
    appearance,
    componentCatalog,
    enableFreeform,
    showSetup,
  };
  callbacks.current = { onChange, onReady, onError };
  useEffect(() => {
    let disposed = false;
    import('@sitebuilder/editor')
      .then(({ mountEditor }) => {
        if (disposed) return;
        instance.current = mountEditor(host.current, {
          ...latest.current,
          onChange: (d) => callbacks.current.onChange?.(d),
        });
        callbacks.current.onReady?.(instance.current);
      })
      .catch((e) => callbacks.current.onError?.(e));
    return () => {
      disposed = true;
      instance.current?.destroy();
      instance.current = null;
    };
  }, [adapter]);
  useEffect(() => {
    if (instance.current && !instance.current.hasUnsavedChanges)
      instance.current.update({ document, version });
  }, [document, version]);
  useEffect(() => instance.current?.update({ data }), [data]);
  return createElement('div', {
    ref: host,
    'data-website-editor': 'react',
    style: { height: '100%', minHeight: '600px' },
  });
}
