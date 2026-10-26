import { createJsonClient } from '@sitebuilder/core';
export function createDjangoAdapter({
  websiteId,
  capabilities = [],
  sources = [],
  brandKit,
  openSource,
  workspace,
  recoveryScope,
  dataSources,
  openPage,
  openRegion,
  changeSource,
  createPage,
  exit,
  preserveReviewOrigin = false,
  ...transport
}) {
  const { send } = createJsonClient(transport);
  const site = `sites/${encodeURIComponent(websiteId)}/`;
  return {
    capabilities,
    sources,
    openSource,
    workspace,
    recoveryScope: recoveryScope || workspace?.recoveryScope,
    dataSources,
    openPage,
    openRegion,
    changeSource,
    createPage,
    exit,
    ...(workspace?.mediaUpload
      ? {
          uploadMedia: async (file, alt = '') => {
            const body = new FormData();
            body.append('file', file);
            body.append('alt', alt);
            return (await send(`${site}media/`, { method: 'POST', body })).asset;
          },
        }
      : {}),
    listReviews: (offset = 0) => send(`${site}reviews/?offset=${offset}`),
    readReview: (id) => send(`${site}reviews/${encodeURIComponent(id)}/`),
    updateReview: (id, value) =>
      send(`${site}reviews/${encodeURIComponent(id)}/`, { method: 'PUT', body: value }),
    revokeReview: (id) =>
      send(`reviews/${encodeURIComponent(id)}/revoke/`, { method: 'POST', body: {} }),
    resolveReviewThread: (id, threadId, resolved) =>
      send(`reviews/${encodeURIComponent(id)}/threads/${encodeURIComponent(threadId)}/`, {
        method: 'POST',
        body: { resolved },
      }),
    listRevisions: async () => (await send(`${site}revisions/`)).revisions,
    readRevision: async (id) =>
      (await send(`${site}revisions/${encodeURIComponent(id)}/`)).revision,
    restoreRevision: (id, expectedVersion) =>
      send(`${site}revisions/${encodeURIComponent(id)}/restore/`, {
        method: 'POST',
        body: { expectedVersion },
      }),
    listGlobalSections: async () => (await send(`${site}globals/`)).sections,
    createGlobalSection: async (name, node) =>
      (await send(`${site}globals/`, { method: 'POST', body: { name, node } })).section,
    readGlobalSection: async (id) =>
      (await send(`${site}globals/${encodeURIComponent(id)}/`)).section,
    saveGlobalSection: async (id, value) =>
      (await send(`${site}globals/${encodeURIComponent(id)}/`, { method: 'PUT', body: value }))
        .section,
    publishGlobalSection: async (id, expectedVersion) =>
      (
        await send(`${site}globals/${encodeURIComponent(id)}/publish/`, {
          method: 'POST',
          body: { expectedVersion },
        })
      ).section,
    readDesign: async (kind, id) =>
      (await send(`${site}${kind}/${encodeURIComponent(id)}/`)).design,
    updateDesign: async (kind, id, value) =>
      (await send(`${site}${kind}/${encodeURIComponent(id)}/`, { method: 'PUT', body: value }))
        .design,
    deleteDesign: (kind, id, expectedVersion) =>
      send(`${site}${kind}/${encodeURIComponent(id)}/`, {
        method: 'DELETE',
        body: { expectedVersion },
      }),
    readTemplateVersion: async (id, number) =>
      (await send(`${site}templates/${encodeURIComponent(id)}/versions/${number}/`)).template,
    listDesigns: async (kind, { offset = 0, archived = false, q = '' } = {}) => {
      const result = await send(
        `${site}${kind}/?` +
          new URLSearchParams({
            summary: '1',
            offset: String(offset),
            archived: archived ? '1' : '0',
            q,
          }),
      );
      return { designs: result[kind], nextOffset: result.nextOffset };
    },
    listTemplates: async () => (await send(`${site}templates/`)).templates,
    saveTemplate: async (name, document, description = '') =>
      (
        await send(`${site}templates/?summary=1`, {
          method: 'POST',
          body: { name, document, description },
        })
      ).template,
    listSections: async () => (await send(`${site}sections/`)).sections,
    saveSection: (name, node) =>
      send(`${site}sections/?summary=1`, { method: 'POST', body: { name, node } }),
    loadData: async () => (await send(site)).data,
    getBrandKit: async () => brandKit || { version: 1, colors: {} },
    saveDraft: (document, expectedVersion) =>
      send(site, { method: 'PUT', body: { document, expectedVersion } }),
    publish: (expectedVersion) =>
      send(`${site}publish/`, { method: 'POST', body: { expectedVersion } }),
    createReview: async (_document, expectedVersion, options = {}) => {
      const result = await send(`${site}reviews/`, {
        method: 'POST',
        body: {
          expectedVersion,
          canComment: options.canComment ?? true,
          lifetimeDays: options.lifetimeDays ?? 7,
        },
      });
      if (!preserveReviewOrigin && typeof window !== 'undefined' && result.url) {
        const url = new URL(result.url, window.location.origin);
        result.url = window.location.origin + url.pathname + url.search + url.hash;
      }
      return result;
    },
  };
}
