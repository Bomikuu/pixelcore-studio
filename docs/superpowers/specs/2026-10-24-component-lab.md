# Component Lab — proposed standalone Studio feature

## Confirmed intent

Import an external section or component, including an interactive Three.js banner, upload its files and preview it before reuse. The import/management page belongs only to standalone Studio and must stay outside installed editor packages. The user confirmed that approved imports should also be available to PixelCore and other installed projects through an optional component catalog.

## Proposed experience

A dedicated `/studio/components` page: Import → Preview → Configure → Save draft → Approve for catalog. Library cards show a thumbnail, name, category, source and version. A focused workspace combines file/entry-point details, a responsive interactive preview and editable-property controls. Keep the existing Pixelcore Studio identity, light/dark chrome and canonical UI controls. Preserve upload/configuration state on validation failure and retry. No automatic publication while previewing.

Start with portable builder JSON and browser-ready HTML/CSS/JavaScript ZIP exports with relative assets. Preserve folders and identify missing imports/files. Three.js examples use browser modules with explicitly pinned dependencies. Raw React/Vue project sources require an adapter or browser-ready export; upload does not imply a build, dependency installation or execution of package lifecycle scripts.

Ask for useful context: section/component/background, landing/storefront/event usage, fixed versus approved live-data inputs, editable text/color/image options, and mobile/reduced-motion fallback. Read an optional manifest to generate simple controls. Keep source URL, author, license/attribution notes, tags and version metadata.

For 3D banners, prefer native editable heading/CTA content layered over the isolated visual component. Provide a poster fallback, pause offscreen work, reduced-motion behavior and quality choices. Preview desktop/tablet/phone, light/dark branding and changed sample inputs; show loading/missing-asset/runtime errors and resource information with an explicit restart control.

## Architectural boundary

- A separate root-level Studio app and its management backend own uploads, archives, validation, review and catalog administration. They are excluded from installable editor/renderer package files and imports.
- The optional catalog supplies approved immutable component manifests and asset URLs. Versions are explicit; draft edits do not silently update live websites. Include rollback and export/import portability.
- A small optional component runtime loads only when a page contains one of these components. Three.js and other dependencies load per component, rather than being added to every installed project or page.
- Imported executable content runs in an isolated iframe with a restricted policy, separate from the editor DOM and authenticated application origin. A validated message bridge exchanges declared settings, sizing/lifecycle messages and an explicit approved public-data payload. Guest/clinical/private records and credentials never become component inputs.
- Native JSON sections remain structured editable content. Interactive code components expose only their declared controls; arbitrary imported source is not assumed to map losslessly into draggable native elements.

## Resolved access

The user approved the proposal and the recommended administrator-only first version on 24 October 2026. Active Studio administrators manage imports; the optional read-only catalog exposes approved components to host projects. Initial account enrollment is available only on the local debug instance.

## Verification for implementation

Automated checks only under current policy; no builds or visual/browser/manual verification. Cover archive path/size rejection and missing files, preview isolation/message validation, failed imports and retry, draft/approval/version boundaries, catalog opt-in, no component runtime on ordinary pages, public-data allowlists, reduced-motion/poster settings, keyboard controls and stable preview teardown. Preview UI is a product capability; it does not authorize the agent to run browser visual tests.

## Reference evidence

- Existing repository: `examples/app.js`, `scripts/dev.mjs`, installable package `files: ["src"]`, core validation and the public/editor renderer boundary.
- Three.js installation/module guidance: https://threejs.org/manual/pages/installation.html
- iframe sandbox and permissions guidance: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe
