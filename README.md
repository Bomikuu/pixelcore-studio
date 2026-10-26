# Website Builder

Studio uses a centered spinner loader and illustrated recovery pages for failed connections, access errors and missing links. Studio opens at `/studio`, with shared sign-in, a website dashboard, account settings and an analytics setup guide. The editor is at `/studio/builder`; Component Lab remains `/studio/components`. See [Studio accounts and platform connections](docs/studio-accounts.md) for session migration, native PixelCore connection setup and analytics consent boundaries.

A shared visual website editor for live storefronts, event websites, and fixed-content landing pages. One renderer and editor; Vue/Nuxt and React/Next adapters. Runs inside each host application, with no shared hosted service.

## Run locally

From this checkout:

```bash
npm install --ignore-scripts
npm run dev
```

Open **http://localhost:4173**. The runner starts a local Django API, checks/applies its migrations, and serves the editor. It uses its own `.data/demo.sqlite3`; it does not use or refresh PixelCore's database. Example records are labeled and the bundled images are the original generated PixelCore sample assets.

The runner uses `.venv/bin/python`, an explicitly configured `WEBSITE_BUILDER_PYTHON`, the adjacent PixelCore virtual environment, or a Python command with Django installed. For a standalone environment:

```bash
uv venv .venv
uv pip install --python .venv/bin/python 'Django>=5.2,<6.1'
npm run dev
```

Optional ports: `PORT=4173`, `WEBSITE_BUILDER_API_PORT=4174`. Bind addresses are loopback only. No Docker, frontend build, background queue, or additional infrastructure is required.

## Included

- Dark canvas workspace with Pages/Layers, a slim tool rail, contextual inspectors, device sizes, and zoom-to-fit. Template and Add libraries open in separate searchable visual dialogs, with real desktop/phone previews.
- Direct text editing with immediate canvas feedback, IME handling, plain-text paste, undo/redo, and protected connected fields.
- Add, duplicate, remove, reorder, nest, and edit elements using validated document operations.
- Six composed templates: Storefront editorial/compact, Wedding editorial/garden, and Landing minimal/image-led. Thirty-six responsive section presets and layout elements use host-owned data.
- Branding import/JSON preview and export; six color schemes; semantic colors; two site-wide font families, plus element size, weight, alignment, spacing, and responsive controls.
- Add reusable page templates or import them from JSON, preview before applying, and export template JSON. Saved templates are shared within the business.
- Text/control contrast calculation, inherited-background findings, image/video review warnings, and publication readiness feedback. These checks do not certify full accessibility.
- Color, gradient, image, and optional video backgrounds; poster fallback; opt-in entrance, hover, and section transitions; reduced-motion behavior.
- Serialized draft saves, retained edits on network failures, version conflicts, and separate immutable publication/review revisions.
- Expiring/revocable guest review links, node-relative numbered pins, comments/replies, and owner resolution. Reviewers enter an unverified name without a system account.
- A separately loaded, experimental free-form package. **It is disabled by default** until its host records browser responsiveness and performance evidence. Structured editing is the supported default.

## Install in a host

The packages are local workspace packages under `packages/`. They are not published to a remote registry yet. Install the needed package directories alongside this repository; PixelCore's frontend already declares local dependencies this way. When publishing releases later, use a resolved registry owner and install the corresponding versioned packages.

```js
import { WebsiteEditor, WebsitePage } from '@sitebuilder/vue';
// React client: @sitebuilder/react
// React server-rendered public content: @sitebuilder/react/server
import { createDjangoAdapter } from '@sitebuilder/editor';
```

For a native DOM host:

```js
import { mountEditor, createDjangoAdapter } from '@sitebuilder/editor';
const adapter = createDjangoAdapter({ websiteId, capabilities, sources, brandKit });
const editor = mountEditor(element, { document, data, version, adapter });
// Before host navigation: consult editor.hasUnsavedChanges.
// On unmount: editor.destroy().
```

Use `renderPage(document, resolvedData)` from `@sitebuilder/renderer` for canonical server HTML; call `enhancePage(root)` on the client for optional background-video and section-motion behavior. Core and renderer import no editor runtime. React/Next public server entry points should use `@sitebuilder/react/server`.

See [adapter contract](docs/adapter-contract.md), [architecture](docs/architecture.md), and [verification](docs/verification.md).

## PixelCore integration

Install this checkout next to `pixelcore-platform`. PixelCore's root development command still starts only its existing frontend/backend. Its Django settings detect the sibling Python package; migration checks include the shared builder automatically.

Open **Site → Visual studio**, a page editor's **Visual studio**, or **Event website → Visual studio**. The studio imports a draft from existing content and resolves real approved business data. It does not change the live layout until Publish. Publishing from the older editor deliberately selects that renderer again; the visual draft remains available.

Docker development mounts this sibling checkout into the existing frontend/backend containers. No new service is needed. Both Dockerfiles declare a named additional build context for future image creation; no image build is required merely to use an already-built development container with the updated mounts and dependencies.

Medframe's React integration contract and server-rendering adapter are available. Activation in its existing clinical application is a separate host rollout; the builder never reads patient or encounter data. DineEase is not locally available and has not been modified.

## Checks

```bash
npm test
npm run test:backend
npm run typecheck
npm run check
npm run format:check
```

Tests include DOM editing, semantic accessibility, cross-framework SSR parity, and the local HTTP runner against an isolated database. Type checking validates the published declarations and typed consumer fixtures. No application builds or visual tests are used by these commands.

Changes are maintained here once, then installed and deployed by each consumer. Installed modules do not silently update deployed applications.

## Redesigned studio and wedding RSVP

First-time setup asks for purpose, live/fixed content, a starting layout, and branding in three short screens. PixelCore pre-fills its existing source; returning drafts skip setup. Open Website context and settings to revisit it. Templates replace only the draft in one undoable operation. Saved sections are tenant-scoped copies stored by the shared Django app (`0002_savedsection` migration).

The canvas exposes the host header and footer as global regions. Select one to open a separate site-wide layout draft. Its publication lists affected pages and stays independent of page publication. The studio uses a safe public-data representation of native regions; complex native menus, popup behavior and cart interactions remain in PixelCore. Older review snapshots retain the original region configuration.

Wedding templates include registered event widgets. Private invitation routes mount the existing PixelCore RSVP component inside the composition after token authorization; the existing API, deadline/capacity/party rules and guest records stay authoritative. Anonymous pages explain that a private invitation link is needed. Editor/review forms are inert samples. RSVP routes and API payloads are private/no-store/no-index/no-referrer.

Self-hosted Manrope and Cormorant Garamond font files include their OFL notices under `packages/renderer/src/assets/fonts`. Public server-only hosts can load these through their usual font setup; local file URLs are never emitted into HTML.

## Global fonts and reusable templates

Open **Theme & branding** to set **Primary font (headings)** and **Secondary font (body)**. These families apply throughout this website at every breakpoint. Selected elements show their assigned global font; they cannot override its family. Font size, weight and spacing remain editable. Legacy element font-family settings are ignored in rendering and removed when editing/saving a draft. Existing immutable revisions are not rewritten. Embedded PixelCore RSVP uses this same pair.

The six built-in templates are complete responsive websites. Choose a storefront for a live collection and shopping guide, a wedding/event template for its programme, venue, guest details and native RSVP, or a landing page for an authored introduction, approach, gallery and FAQs. Each includes a single header, content sections and a footer. Template details list the full structure before applying. Setup offers both compatible templates for the chosen purpose.

Headers and footers use host navigation when supplied; otherwise they link to the page’s sections, keeping RSVP and contact accessible. Footers show approved `identity.socials` entries (`platform` or `label`, plus an HTTP(S) `url`) and clickable public email/phone details. Configure these in the connected business’s branding/source settings. Missing social/contact information is omitted. Templates reference approved media from the destination library; they do not download stock images or invent accounts, testimonials or product records. Fixed landing text starts from the approved business identity and stays editable; live catalog/event bindings continue to resolve current records.

Choose **Open full-page preview** in a template’s details to inspect the entire site, including its footer. Desktop, Tablet and Phone render at 1280, 768 and 390 pixels; Fit to window changes display scale without changing the chosen layout viewport. Use 100% for actual size. The preview is keyboard-focusable and scrollable; links and guest submissions remain inactive. Close returns to the chooser without editing the page.

Template branding defaults to keeping the current theme. You can explicitly choose template colors while retaining the global primary/secondary fonts. Context setup additionally offers a validated connected business brand kit when available. “Keep” preserves colors, global fonts, type sizes and other theme settings.

Fixed content means an authored page body. Adding a connected field or live collection enables Live data in the same undoable edit. Remove or detach those connections before choosing fixed content. Templates advertise their content mode; fixed setup disables live-only templates. Shared branding/header/footer remains connected in either mode. Legacy contradictory drafts remain recoverable, but publication rejects them in both the editor and Django service. Publishing a shared section cannot introduce live content into an already published fixed page.

Before publishing, unfilled image, video and gallery slots produce actionable warnings. Choose media or remove the element for a text-only layout. Missing referenced assets remain blockers. The Media workspace also lists unfilled elements and can select them for editing.

Open **Templates → Add template** to save the current page as a named reusable layout. **Templates → Import JSON** opens a file picker, validates the document, and displays a preview before **Save template** adds it to **My templates**. Neither action edits the current page. Choose a saved template, preview desktop/phone, and use **Apply to this page** to replace content in one undoable operation. Applying a template retains the destination page identity, source context, primary/secondary fonts and host-managed header/footer.

**Export template JSON** produces `{ "version": 1, "name": "…", "description": "…", "document": { … } }`. Import also accepts a raw website document from the editor’s **Export** action. Files are limited to 550 KB; documents retain the existing 500 KB/500-element/nesting limits. Unsupported versions, unknown fields, executable content and invalid identities are rejected. JSON carries content and approved asset IDs, not asset files or source/review snapshots; referenced media must exist in the destination library. Connected sections resolve the destination system’s data and still require the appropriate capabilities.

Saved templates use `0003_savedtemplate`, an additive Django migration applied by the standalone/root dev launchers. Hosts use the existing migration command during rollout. The library requires website management permission and is tenant-scoped, with a limit of 100 templates. Custom adapters can implement `listTemplates()` and `saveTemplate(name, document, description)`; without storage, built-in templates remain available and creation/import are disabled.

## Recovery, history, data and shared sections

- **History** lists saved revisions and labels the current draft and live publication. **Compare draft with live** shows both layouts with added/removed/changed element counts. Both previews use current approved data; comparison does not claim to restore past operational records. Restoring a revision creates a new draft and retains the current publication.
- **Recover** appears when an unsaved local copy is found. Recovery contains the validated document only, with a seven-day restore window and a host-issued user/tenant/site scope. Restore, export or discard explicitly; newer server versions permit export/discard. An unresolved older recovery remains available even if new work is saved. Current edits retain recovery through save errors and inline-typing/save races. PixelCore logout clears builder recovery copies in this browser and stops pending editors from recreating them.
- **Connect system data** opens the approved source/field catalog. Select text, a button or image to connect compatible fields. Collection sources offer connected cards: edit one card template, while actual host records populate every card. Configure page size/record offset, scalar equality filters, sorting and empty text. These controls operate on the host-supplied public collection window; they do not introduce a separate database or arbitrary query endpoint. The existing host owns full catalog/search pagination and operational actions. Loading/error/unavailable/empty states are distinct.
- **Shared sections** creates an independent source from a selected section, links it to pages, edits it in isolation, saves a shared draft and publishes that source separately. Publication lists affected pages. Page publication never publishes a pending shared draft; publish a new shared source before publishing a page that links it. Detach creates an undoable editable local copy; if the source is unavailable, confirm use of the saved copy. Published pages receive published source content only, including their inspectable API document; review links freeze their resolved source version.
- **Responsive layout** shows desktop/tablet/phone inheritance, per-property reset, per-device visibility, padding sides, columns, flex alignment/wrapping and percentage/min/max widths. Phone overrides consistently win after tablet overrides. Spacer height supports breakpoints. Transitions/free positioning and video selection are configured on Desktop; mobile solid/image background overrides can replace the inherited video. Heading contrast uses the actual theme type scale.

Migration `0004_globalsection_globalsectionrevision_and_more` is additive. The existing standalone and PixelCore root dev commands apply builder migrations; no extra runtime service is required. Update host Python and frontend packages together. Medframe remains unactivated.

## Library management, page settings and media

Open **Templates → Manage saved designs** (also available from Add) to manage templates and saved sections. Rename, tag, archive/restore or permanently delete a library copy. Archived designs stay out of insertion libraries. Deletion frees a library slot; existing pages and their page revisions remain intact. Templates keep immutable versions: save the current page as a new version, restore an earlier version as another version, or export any listed version. Stale updates require reopening the library. Imported 180-character page titles retain their full title while suggesting a shorter library name.

Select the page to open **Search & sharing**: search/social titles and descriptions, social image, canonical URL and indexing. Page checks flag heading structure and missing alt text. Applying a template retains the destination SEO settings. Hosts use `pageHead(document, data, options)` for framework-neutral metadata or `renderPage(...).head` for values; Vue/React page components render the body and leave document-head ownership to the host. PixelCore wires these to public storefront/event pages, keeps private RSVP pages noindex, and removes hidden builder pages from its sitemap. Route/navigation controls open host settings.

**Your media** supports image upload when the host advertises `workspace.mediaUpload` and connects `WEBSITE_BUILDER_UPLOAD_MEDIA`. JPEG, PNG and WebP images are limited to 8 MB and 20 megapixels. The shared processor strips metadata, preserves orientation, caps dimensions at 2400 px and produces WebP plus 640/1280 px renditions where useful. PixelCore stores these in its existing business asset library. Standalone media lives under `.data/media`; its demo-only database rows are unused by production hosts. No queue or Docker service is required. Pillow is a Python dependency.

Search/select media, replace unresolved imported asset IDs, and edit image alt text, decorative purpose, fit, crop ratio and focal point. Linked shared-source images are edited through that source. JSON templates carry asset IDs, not media bytes. New uploads are images; select existing approved videos from the host library. Video playback is user-controlled. Captions/transcripts must be supplied in source media/content; this release does not generate them.

The Add library now includes FAQ accordions, keyboard-accessible tabs, video/story, contact links, location/directions, opening hours, responsive logos and feature columns. FAQ works without JavaScript; tabs show all content until enhancement. Location opens an external map on request. Replace example contact details/hours before publishing. Contact forms still need a host submission contract.

Migrations `0005`–`0007` add saved-design management, initial immutable template versions and standalone media records. The normal local dev launchers apply these automatically; deployed consumers run their usual Django migrations. Keep shared JS/Python updates together.

## Light mode, tooltips and selection

The studio starts in **light mode**. Use the **sun/moon button near the bottom of the tool rail** to switch appearance; the preference is remembered in this browser. It affects the editor, dialogs and tooltips, while the website keeps its own palette. A host can set `appearance: 'light' | 'dark'` initially through native/React/Vue editor options.

Sidebar tools have custom hover/focus tooltips and restrained SVG icons. Selecting a layer or canvas element reveals and focuses it, expands its path in Layers and updates the inspector. On small screens selection opens the inspector. **Edit properties** moves focus directly to its controls. Input/caret/scroll survive inspector commits; inline editing and IME retain focus. Disabled actions indicate movement boundaries, the required collection card or missing host capabilities.

**Preview** supports native accordions, keyboard tabs, videos and safe links. In-page anchors reveal their destination; other links open separately. Return with **Back to editing**. Private RSVP submission still belongs to the authorized live invitation page. Rapid library navigation ignores stale reads, and saving a section prevents duplicate requests.

## Larger tool dialogs and media cards

**Theme & branding**, **Media library**, **Shared sections** and **Connect system data** open spacious dialogs, with top navigation for switching tools. Pages/Layers and selected-element properties stay beside the canvas. The page inspector’s Theme & branding action opens this same workspace. Theme controls now have room beside a read-only preview of the current draft; changes continue through the normal autosave workflow and retain the global primary/secondary font policy.

Media is a thumbnail grid with an **Add media** card at the end. Select an image/video to inspect it, then choose **Add to page** or **Replace selected media**. Search/filter the library and load more cards as needed. Add media reveals file, alt-text and upload controls inside the same dialog. Upload state survives switching tools, errors retain the selected file for retry, and successful uploads remain available even if you close the workspace before they finish. Choosing media closes the dialog and focuses the resulting canvas element. Images still use the existing authenticated project storage and optimization pipeline.

## Component Lab

Run `npm run dev`, then open [Component Lab](http://localhost:4173/studio/components). Create the local administrator account on first visit, import a ZIP/builder JSON and preview it before approving it into the optional catalog. The importer stays outside installed packages; Three.js is loaded only by components using it. See [the package and integration guide](docs/component-lab.md).
