import { loadingState } from './states.js';
import { mountSourcePicker } from './source-picker.js';
import { mountEditor, createDjangoAdapter } from '@sitebuilder/editor';
import { applyTemplate } from '@sitebuilder/renderer';
import { el, button } from '../../packages/editor/src/components/ui/index.js';
export async function mountBuilder(region, { client, workspace, websiteId, mountHeader, onReady }) {
  const d = region.ownerDocument;
  if (!websiteId && !workspace.workspace.sample)
    return mountSourcePicker(region, { client, workspace });
  region.replaceChildren(
    loadingState(d, {
      title: 'Opening your website builder…',
      description: 'Loading the saved layout and approved system data.',
    }).element,
  );
  let setup = await client.send('workspace/open/', {
    method: 'POST',
    body: websiteId ? { websiteId } : {},
  });
  if (!setup.document)
    setup = await client.send('workspace/open/', {
      method: 'POST',
      body: { document: applyTemplate('storefront') },
    });
  const caps = setup.capabilities || {};
  const adapter = createDjangoAdapter({
    websiteId: setup.id,
    baseUrl: setup.transportBase || '/api/website-builder/',
    csrfCookieName: 'studio_csrftoken',
    preserveReviewOrigin: !workspace.workspace.sample,
    capabilities: caps.features,
    sources: caps.sources,
    dataSources: caps.dataSources,
    brandKit: caps.brandKit,
    workspace: caps.workspace,
    exit: () => {
      d.defaultView.location.href = '/studio';
    },
  });
  region.classList.add('builder-main');
  const host = el(d, 'div', { class: 'studio-editor-host' });
  region.replaceChildren(host);
  let dialogRoot;
  const editor = mountEditor(host, {
    exitLabel: 'Back to dashboard',
    mountHeader: mountHeader
      ? (container, context) => {
          dialogRoot = context.root;
          return mountHeader(container, context);
        }
      : undefined,
    document: setup.document,
    version: setup.version,
    data: setup.data,
    adapter,
    demo: !!workspace.workspace.sample,
    showSetup: true,
    componentCatalog: { url: d.defaultView.location.origin + '/api/studio/catalog/' },
  });
  onReady?.();
  return {
    dialogRoot,
    get hasUnsavedChanges() {
      return editor.hasUnsavedChanges;
    },
    destroy() {
      editor.destroy();
      region.replaceChildren();
    },
  };
}
