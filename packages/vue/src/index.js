import { defineComponent, h, ref, onMounted, onBeforeUnmount, watch, onUpdated } from 'vue';
import { renderPage, enhancePage, enhanceAnalytics } from '@sitebuilder/renderer';
export const WebsitePage = defineComponent({
  name: 'WebsitePage',
  props: {
    document: { type: Object, required: true },
    data: { type: Object, default: () => ({}) },
    mode: { type: String, default: 'public' },
    landmark: { type: Boolean, default: true },
    baseUrl: { type: String, default: '' },
    widgets: { type: Object, default: () => ({}) },
    componentCatalog: { type: Object, default: undefined },
    componentData: { type: Object, default: () => ({}) },
    analyticsConsent: { type: Boolean, default: false },
  },
  setup(p) {
    const host = ref(null);
    let cleanup;
    let analyticsCleanup;
    let widgetsCleanup = [];
    let componentAbort, componentCleanup;
    const enhance = () => {
      analyticsCleanup?.();
      componentAbort?.abort();
      componentCleanup?.();
      cleanup?.();
      widgetsCleanup.forEach((dispose) => dispose?.());
      widgetsCleanup = [];
      if (p.mode === 'public' && host.value)
        for (const marker of host.value.querySelectorAll('[data-wb-widget]')) {
          const mount = p.widgets[marker.dataset.wbWidget];
          if (mount)
            widgetsCleanup.push(
              mount(marker, { nodeId: marker.dataset.wbId || marker.dataset.wbPart }),
            );
        }
      if (host.value && p.mode === 'public') cleanup = enhancePage(host.value);
      if (host.value)
        analyticsCleanup = enhanceAnalytics(host.value, p.document.analytics, {
          consent: p.analyticsConsent,
          mode: p.mode,
        });
      if (
        host.value &&
        p.mode === 'public' &&
        p.componentCatalog?.url &&
        host.value.querySelector('[data-component-id]')
      ) {
        const controller = new AbortController();
        componentAbort = controller;
        import('@sitebuilder/components')
          .then(({ enhanceComponents }) => {
            if (controller.signal.aborted || !host.value) return () => {};
            return enhanceComponents(host.value, {
              catalogUrl: p.componentCatalog.url,
              publicData: p.componentData,
              theme: p.document.theme,
              signal: controller.signal,
            });
          })
          .then((dispose) => {
            if (controller.signal.aborted) dispose();
            else componentCleanup = dispose;
          })
          .catch(() => {});
      }
    };
    onMounted(enhance);
    onUpdated(enhance);
    onBeforeUnmount(() => {
      analyticsCleanup?.();
      componentAbort?.abort();
      componentCleanup?.();
      cleanup?.();
      widgetsCleanup.forEach((dispose) => dispose?.());
    });
    return () =>
      h('div', {
        ref: host,
        'data-website-host': 'vue',
        innerHTML: renderPage(p.document, p.data, {
          mode: p.mode,
          baseUrl: p.baseUrl,
          landmark: p.landmark,
        }).html,
      });
  },
});
export const WebsiteEditor = defineComponent({
  name: 'WebsiteEditor',
  props: {
    document: { type: Object, required: true },
    data: { type: Object, default: () => ({}) },
    adapter: { type: Object, required: true },
    version: { type: Number, default: 0 },
    appearance: {
      type: String,
      default: undefined,
      validator: (value) => ['light', 'dark'].includes(value),
    },
    enableFreeform: { type: Boolean, default: false },
    showSetup: { type: Boolean, default: false },
    componentCatalog: { type: Object, default: undefined },
  },
  emits: ['change', 'ready', 'error'],
  setup(props, { emit, expose }) {
    const host = ref(null);
    let editor,
      disposed = false;
    onMounted(async () => {
      try {
        const { mountEditor } = await import('@sitebuilder/editor');
        if (disposed) return;
        editor = mountEditor(host.value, {
          ...props,
          onChange: (document) => emit('change', document),
        });
        emit('ready', editor);
      } catch (error) {
        emit('error', error);
      }
    });
    watch(
      () => props.data,
      (data) => editor?.update({ data }),
    );
    watch(
      () => props.document,
      (document) => {
        if (editor && !editor.hasUnsavedChanges)
          editor.update({ document, version: props.version });
      },
    );
    onBeforeUnmount(() => {
      disposed = true;
      editor?.destroy();
    });
    expose({
      save: () => editor?.save(),
      getDocument: () => editor?.getDocument(),
      hasUnsavedChanges: () => editor?.hasUnsavedChanges,
    });
    return () =>
      h('div', {
        ref: host,
        'data-website-editor': 'vue',
        style: { height: '100%', minHeight: '600px' },
      });
  },
});
