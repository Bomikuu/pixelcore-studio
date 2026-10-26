# Component Lab

Component Lab now shares Studio's session and account navigation with `/studio`, `/studio/builder`, `/studio/settings` and `/studio/analytics`. Local accounts retain their credentials; sign in once after the move to Studio-specific cookie names. Verified platform users do not automatically gain component administration. See [Studio accounts](studio-accounts.md) for configuration and profile ownership.

Open **http://localhost:4173/studio/components** after `npm run dev`. The first local visit lets you create the Studio administrator account (12-character minimum password). There are no preset credentials. Existing Studio administrators sign in. Hosted deployments must provision staff accounts through their normal account management; first-owner enrollment is available only in local debug mode.

## Import and preview

1. Download the Three.js starter ZIP from the Lab, or choose a browser-ready ZIP or builder JSON export.
2. Choose **Import component**, select the file and optionally identify its name, type, usage and source link.
3. **Upload and preview** saves an immutable draft. Interactive previews run on a separate origin; native JSON previews use the existing renderer.
4. Try Desktop, Tablet and Phone. Toggle the preview theme, pause motion or restart. Editable package fields update the preview; declared public preview inputs live under Preview inputs.
5. **Save defaults** makes another draft version. **Add to catalog** explicitly approves the selected version. Saving/importing never approves automatically.
6. Versions can be previewed, exported or approved again to roll back future catalog insertions. Already-inserted pages retain their pinned version. Approved older runtime versions remain available for those pages.

The library offers search, Drafts/In catalog filtering and twelve cards per batch. Details include source/author/attribution notes, usage, type, entry/poster assets and package size. Upload errors preserve the chosen file and context. Unsaved defaults have a discard guard; Ctrl/Cmd S saves defaults in the workspace.

## Package format

A ZIP contains `component.json` at its root, an HTML entry and all referenced relative files. Download the starter for a working package. The first version supports HTML, CSS, browser JavaScript/modules, raster/SVG images, GLB/GLTF/bin models, web fonts and video. Uploads never run dependency installation, build scripts, Python or server executables. Raw framework sources need a browser-ready export or adapter.

```json
{
  "schemaVersion": 1,
  "name": "Orbit banner",
  "kind": "background",
  "usage": "landing",
  "entry": "index.html",
  "height": 420,
  "poster": "",
  "sourceUrl": "",
  "author": "",
  "license": "",
  "tags": ["banner"],
  "fallbackText": "An animated orbit background",
  "networkOrigins": ["https://cdn.jsdelivr.net"],
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js"
  },
  "fields": [
    { "key": "color", "label": "Orbit color", "type": "color", "default": "#3d5afe" },
    {
      "key": "speed",
      "label": "Rotation speed",
      "type": "number",
      "min": 0,
      "max": 3,
      "default": 1
    }
  ],
  "dataKeys": ["title"]
}
```

Supported setting types: text, color, number, select (with string `options`) and image (HTTPS link). Packages declare exact HTTPS resource origins and pin external module versions. Local module-map targets resolve from the package root. Resource access is restricted by the preview policy; uploaded assets are served with explicit MIME types and no credential forwarding. Images fetched remotely by component code must use declared origins.

The trusted runtime bridge exposes:

```js
const unsubscribe = ComponentLab.onUpdate(({ settings, data, theme, motion, visible }) => {
  // Update the local scene; pause rendering when hidden or motion is disabled.
});
```

Theme colors are also available as `--brand-background`, `--brand-primary`, etc. Respect reduced motion and release graphics resources on teardown. Keep ordinary website headings/buttons as native builder elements where possible, so they retain normal content editing and global fonts. Arbitrary code imports expose their declared controls rather than becoming native draggable element trees.

Limits: 20 MB upload, 60 MB expanded ZIP, 150 entries, 200 components, 100 immutable versions per component, twenty editable settings and twelve public input names. Media storage has a conservative 500 MB budget. Archives with duplicate paths, traversal, symlinks, encryption, missing references or unsupported executable files are rejected. Native JSON sections reconnect host data at the destination; operational widgets and shared-source references cannot be imported through this route.

## Optional catalog integration

The management app lives under `studio/`; Python packaging includes only `website_builder*`, and npm packages include only their own `src`. Installed projects receive no upload page, management server or Three.js dependency. The small optional runtime is loaded only for configured pages containing catalog components.

The standalone builder already exposes a **Component catalog** rail action. Other hosts opt in explicitly:

```js
mountEditor(element, {
  document,
  adapter,
  componentCatalog: { url: 'https://studio.example.com/api/studio/catalog/' },
});
```

Vue and React `WebsiteEditor` accept the same `componentCatalog` option. `WebsitePage` accepts it plus `componentData`, an explicit mapping of approved public scalar values. Only names declared in each manifest cross the message bridge. Neither adapter discovers or forwards the whole host data object. Rendering remains an inert fallback in review/editor/SSR modes and when no catalog is configured.

For a native JavaScript public page:

```js
// Call only on a page containing [data-component-id].
const { enhanceComponents } = await import('@sitebuilder/components');
const controller = new AbortController();
const cleanup = await enhanceComponents(pageElement, {
  catalogUrl: 'https://studio.example.com/api/studio/catalog/',
  publicData: { title: approvedEvent.title },
  theme: websiteDocument.theme,
  signal: controller.signal,
});
// On navigation/unmount: controller.abort(); cleanup();
```

Catalog reads use credentials: omit. Public catalog summaries contain metadata; full native sections hydrate only when chosen. Component refs contain ID/version/settings, never raw source or arbitrary executable URLs. Public rendering escapes settings and supplies a static fallback; the optional runtime mounts sandboxed frames. React/Vue adapters abort pending reads and dispose frames on updates/unmount.

## Local services and checks

`npm run dev` starts the website/editor at 4173, Django at 4174 and a cookie-free, runtime-only preview proxy at 4175. Override with `PORT`, `WEBSITE_BUILDER_API_PORT` and `WEBSITE_BUILDER_COMPONENT_PORT`; all three must differ. The process runs migrations, including the standalone Lab migration. Existing host/Docker deployments are not started or rebuilt by this work.

The local runner binds loopback. For hosting, deploy Studio management and the preview service on separate HTTPS origins, retain sandbox/CSP/CORS headers, configure the public runtime origin and normal administrator/rate-limit/session infrastructure. This work configures local development; it does not publish a hosted service.

Automated checks: `npm test`, `npm run test:studio`, `npm run test:backend`, `npm run typecheck`, `npm run check`, `npm run format:check`. No build or browser/visual/manual check is part of this policy.
