# Shared website builder: implementation audit

Date: 2026-10-23. Status: inspection complete; architecture below is a proposal, not an implemented package or an approved implementation spec.

## Intended outcome

Maintain the website editor, templates, public rendering, and preview review workflow in one separate repository. PixelCore, Medframe, DineEase, and future projects install released modules and supply their own actual data through adapters.

The user confirmed that DineEase is not locally available and future projects must be supported. DineEase source was not inspected or modified. Reviewers must be able to open a preview link, enter a name, and comment without creating a system account.

The user subsequently requested a high-end visual builder with a Wix-like editing workflow: premade templates, adding and changing elements, direct text editing, drag arrangement, backgrounds, transitions, branding imports, typography, colors, contrast checks, and preset color schemes. The requested implementation plan is maintained in [the shared-builder plan](./implementation-plan.md). This expands the earlier extraction proposal into a visual editor; it is not merely a shared version of the existing settings forms.

## Inspection evidence

Opened these pages using PixelCore's sample workspace account, without changing website content:

- `/workspace/schedule/events/2e87316e-d0b4-536f-8908-6e58aac42bf4?tab=website`: published Community event, Event spotlight template, invitation/theme/media/schedule editing, and a Preview link to the public event.
- `/workspace/site`: page management, commerce template action, domain management, revision and publication information.
- Its existing home-page editor: outline, live canvas, selected block settings, draft save, preview, and publish controls.
- `/event/2e87316e-d0b4-536f-8908-6e58aac42bf4`: actual event title/date/venue/photo, schedule/story/gallery/wishes sections, and no guest-list display.

Also inspected Medframe's local website implementation at `/home/micxsz/projects/medframe` read-only. Its frontend is React/Next.js, whereas PixelCore uses Vue/Nuxt. Its backend uses Django with GraphQL administration; PixelCore's website administration uses Django REST endpoints.

### Existing implementation map

| Surface              | Editor and renderer                                                                                                                        | Persistence and data                                                                                                                                                                      | Preview today                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| PixelCore event      | `pixelcore-frontend/components/scheduling/EventWebsiteEditor.vue`, `components/event/WeddingInvitationPage.vue`, `utils/eventTemplates.js` | `VenueEvent` and related participants, schedule entries, story, media, and approved wishes; `VenueEventWebsiteView` / `PublicEventWebsiteView` in `pixelcore-backend/scheduling/views.py` | Editor Preview is `/event/:id`, available when published. It is the public page, not a separate saved draft.                      |
| PixelCore site       | `pixelcore-frontend/pages/workspace/site/pages/[pageId].vue`, `components/site/StorefrontPage.vue`, `SiteBlockRenderer.vue`                | `Site`, `SitePage`, immutable `PageRevision`; manifest adds business identity and referenced assets; catalog is also fetched from the host                                                | Signed token for the latest saved draft, valid for one hour.                                                                      |
| Medframe clinic site | `apps/web/features/websites/website-editor.tsx`, `site-page.tsx`, `schema.ts`                                                              | `ClinicWebsite`, `WebsitePublication`, `WebsiteDomain`; website actions use an expected version; public queue reads actual queue tickets                                                  | Inline draft preview with desktop/phone widths; no shareable draft-review endpoint found in the inspected website implementation. |

PixelCore's storefront is more than the CMS blocks: business appearance controls header, footer, global hero, popup, typography, and storefront family. `StorefrontPage.vue` composes these around the blocks and selects Marketplace or Brand/Luxury presentation. Extracting only `SiteBlockRenderer.vue` would leave much of the website implementation duplicated.

The event implementation has nine presets grouped into wedding, birthday, and general compositions. One public renderer currently implements those variants. Its private invitation and RSVP routes are separate authorization contexts and must remain so.

Medframe's editable service and team lists are website content; they are not automatically bound to operational service/team records. Its public queue is live operational data, and public images are restricted to clean website/logo documents belonging to the organization and unrelated to patients or encounters.

### Specific gaps affecting extraction

1. **Event saves can change the live website.** `VenueEventWebsiteView.patch` updates the event and nested content directly. There is no independent immutable website draft/publication boundary comparable to `PageRevision`.
2. **An old storefront preview breaks after another draft save.** The token includes a revision ID, but `PublicPagePreviewView` requires that revision to remain the page's current `draft_revision`. The existing immutable revision still exists, yet the old URL becomes unavailable.
3. **Unsaved edits are absent from storefront preview.** The editor's `openPreview()` requests a token without saving the current canvas first. Previewing must distinguish unsaved local work from a saved shareable revision.
4. **Saving a new storefront draft can hide its live page.** Source inspection shows `create_revision()` setting `page.status = "draft"`, while public manifest lookup requires `status="published"`. The retained published revision does not by itself keep that route available. This was identified in source, not reproduced by mutating the running sample website.
5. **There is no preview annotation persistence in the inspected website paths.** Event guest wishes are event content, not design-review comments.
6. **DOM anchors are insufficient for review comments.** Storefront blocks already have content IDs, but the rendered wrapper exposes only `data-block-type`. Event section anchors such as `#hero` and `#story` do not identify every editable field, nested item, or revision.
7. **A revision alone does not freeze all visible data.** PixelCore manifests combine revision content with current identity/catalog/assets. A stable review needs an explicit policy for these dependencies.

Source references: `pixelcore-backend/content/services.py` (`create_revision`, `make_preview_token`, `read_preview_token`), `content/views.py` (`PagePreviewTokenView`, `PublicPagePreviewView`, `PublicSiteManifestView`, `manifest_response`), `scheduling/views.py` (`VenueEventWebsiteView`, `PublicEventWebsiteView`); Medframe `services/api/medframe_apps/websites/services.py`, `models.py`, and `public.py`.

## Packaging options

| Approach                                                                                      | Benefit                                                                                                    | Cost or mismatch                                                                                               |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Installable shared engine, one embedded editor, and thin framework adapters — recommended** | One source of templates and editing behavior; runs with existing application processes; host owns its data | Consumers must install releases and deploy them; shared SSR/client rendering must be proven on both frameworks |
| Centrally hosted builder/review service                                                       | A deployment can update the service for all consumers immediately                                          | Adds a runtime dependency, cross-service authentication, availability and data-transfer concerns               |
| Separate Vue and React builders sharing only a schema                                         | Easy framework-native integration initially                                                                | Duplicates templates and editor behavior, leaving the maintenance problem unresolved                           |

An installed dependency does not update already-deployed consumers by itself. Maintain the change once, publish a versioned release, then update each project's lockfile and deploy. Automatic dependency-update pull requests can reduce that routine work later. Existing saved content needs schema migrations and compatibility checks as package versions change.

## Proposed module boundaries

Working repository name: `website-builder`. Package names and registry ownership are not allocated yet.

| Module                           | Responsibility                                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core                             | Versioned documents, stable node IDs, template registry, validated settings, data-binding contracts, schema migrations, edit operations, and revision metadata                              |
| Renderer and template packs      | One maintained implementation of template structure, styles, safe text/URL handling, server-rendered public HTML, and optional client interactions; shared by public view and editor canvas |
| Embedded editor and review UI    | One editor implementation, template selection, outline, settings, asset selection, responsive canvas, comment pins/threads/replies/resolution; load only on editor/review routes            |
| Vue/Nuxt and React/Next adapters | Lifecycle, routing, SSR integration, style loading, typed properties/events, and host action widgets; no copies of template markup                                                          |
| Django integration               | Reusable revision, publication, review-share, thread, and comment persistence/services, with host-supplied tenant and authorization hooks; REST or GraphQL wrappers remain thin             |

The editor can expose an embeddable custom-element or mount/unmount interface, allowing both frameworks to consume the same editing UI. Public pages require a separate, explicit SSR contract: a browser-only custom element is insufficient. Prove one template with matching server output, editor canvas, and client enhancement in both hosts before choosing the final rendering implementation. Avoid coupling public SEO to experimental SSR machinery without that proof.

Vue and React both document custom-element consumption, supporting this embedding direction: [Vue and Web Components](https://vuejs.org/guide/extras/web-components), [React custom HTML elements](https://react.dev/reference/react-dom/components#custom-html-elements). Server rendering remains a separate engineering concern; [Lit SSR](https://lit.dev/docs/ssr/overview/) currently carries a Labs designation. No new rendering library has been installed or selected by this audit.

### Actual system data

Each host adapter resolves explicit, allowlisted sources rather than allowing arbitrary database queries or API URLs in page content:

- PixelCore: business public identity, products, collections, services, approved public staff profiles, event schedule, event media, and approved wishes.
- Medframe: clinic public identity, expressly selected public services/team content, approved website assets, and the existing anonymous queue number/status feed. Do not infer that operational staff or clinical records are public.
- DineEase and future hosts: implement the same contract once their actual code and authorization rules are available.

The document stores the selected entity IDs and presentation choices. The host resolves those references under the current tenant and supplies a public-safe data envelope. Deleted/unpublished/missing references produce an explicit empty or unavailable state, never content from another tenant or invented replacement data.

Actions such as checkout, booking, RSVP submission, portal access, maps, and uploads are typed host capabilities. The shared builder renders their entry points or integration slots; the host continues to authorize and execute the action. A preview must not accidentally create orders, bookings, RSVP updates, or guest wishes.

For review, create an immutable snapshot of page composition and the public-safe data used to render it, including asset version references. For a live website, resolve approved dynamic bindings at request time or through the host's cache invalidation. Live widgets such as queue status use a static approved preview snapshot or disabled preview state. The snapshot cannot bypass later tenant deactivation, asset access withdrawal, share revocation, or existing public-content restrictions.

## Website modes and visual-editor requirements

### Live data and fixed content

Expose two starting modes using the same document, editor, and renderer:

- **Live data:** a saved layout plus host-resolved current records, such as storefront products, prices, services, event schedule, venue, and approved wishes.
- **Fixed content:** saved text, images, layout, and theme used for landing pages, campaigns, and company pages. Publishing preserves that approved content; an editor change remains a draft until published.

Allow individual sections to combine fixed text and live connections. Live data means loading current values when the page opens or refreshes; subscriptions/polling are explicit per-widget capabilities, not required for every dynamic section. Persist source references and presentation settings rather than copying live records into the template. Fixed content is an authoring policy, not a promise of a separate static-file hosting service.

### Editor workspace and templates

- Use Wix as the editing-workflow reference: a large central canvas, compact top toolbar, a left panel for pages/layers/sections/elements/templates, and a right inspector for the selected item. Keep the builder's own product identity and host-compatible control conventions.
- Provide premade whole-site/page templates, reusable section presets, and an Add elements library. Initial elements include headings, paragraphs, images, buttons/links, containers, columns, dividers, galleries, and host-supported product/service/event widgets.
- Let users select, add, duplicate, hide per breakpoint, delete, and reorder elements. New copies receive new stable IDs. Preserve data connections when changing presentation. Applying a template must show the affected scope and offer undo without destroying live domain records.
- Click or double-click text to edit directly on the canvas, with immediate local rendering, a contextual text toolbar, and undo/redo. Support plain-text paste and a bounded rich-text model; input must not insert arbitrary executable HTML. Handle IME composition without saving unfinished text or losing the caret.
- Distinguish fixed text from connected fields in the inspector. Changing product.name or an event date through inline editing must not silently rewrite the underlying product/event. Offer the existing source editor or an explicit fixed-text override; a missing connection remains visibly identifiable.
- Include desktop/tablet/phone canvas sizes, zoom-to-fit, visible selection, layers, and breakpoint-specific overrides. Canvas zoom changes editing coordinates, not the published font sizes or layout. Preserve semantic reading order and sensible mobile flow.
- Show saving/saved/offline/conflict/error states. Debounce draft persistence, retain pending edits on failure, and reconcile expected-version conflicts without silently overwriting another editor. Navigation warns about unsaved work; publication remains deliberate.

### Layout and drag interactions

- The default is lightweight responsive layout using sections and flex/grid containers. Drag sections or elements before/after another item or into a compatible container, with visible insertion indicators. Include non-drag Move before/after/into controls and keyboard operation.
- Preserve stable element IDs, data bindings, and comment anchors through move/resize. Reject cyclic nesting, incompatible drops, and invalid parent/child combinations without losing the original element.
- Plan optional **free-form positioning inside an explicit canvas section**, including snapping, alignment guides, resize handles, constrained dimensions, layer order, and breakpoint-specific placement. Text and other sections continue to use normal document flow; do not turn the whole website into unconstrained absolute coordinates.
- Free-form sections require a usable phone/tablet fallback and a meaningful DOM reading order. Reflow/overflow checks and performance tests determine release readiness. Keep this capability separately loadable and feature-gated until it meets those checks; it is requested scope, not permanently excluded scope.
- Keep pointer movement local and transient, use animation-frame updates, and commit one undoable document operation per completed drag. Do not issue persistence requests or recalculate the entire document on every pointer move.

### Branding, colors, and typography

- Import each host's validated branding through an adapter: logo, supported font choices, existing palette, and available identity settings. Also support a versioned brand-kit JSON import/export. Preview the imported result and validation errors before applying it to the draft; do not mutate the host's global brand implicitly.
- Use global semantic tokens for page background, surfaces, text, muted text, primary/action, accent, border, and focus. Individual element overrides remain explicit and can be reset to the inherited value.
- Include curated named color schemes, initially Clean light, Editorial dark, Forest, Ocean, Warm neutral, and High contrast. Each preset supplies complete role pairings; validate the actual combinations rather than trusting the preset's name. Schemes can be applied site-wide with a reversible draft operation.
- Expose font family, role, size, weight, line height, letter spacing, alignment, and text colors. Provide a shared heading/body scale and responsive overrides. Preview allowed fonts with fallbacks; font licensing and asset approval remain with the host.
- Compute contrast using resolved foreground/background colors, font size/weight, opacity, and applicable states: at least 4.5:1 for normal text, 3:1 for qualifying large text, and 3:1 for required control indicators against adjacent colors. For the editor's numeric check, qualifying large text is at least 24 CSS px, or at least 14 pt (56/3 CSS px) with bold weight of 700 or greater. Do not round a failing value into a pass. Offer an explicit accessible color suggestion, never a silent brand-color replacement.
- Show pass/fail and ratio next to the relevant controls and in a publish-readiness list. Mark image/video, unsupported blend, or otherwise indeterminate combinations as needing review. An automatic solid-color contrast result alone does not certify an entire website as accessible.

Contrast references: [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Dragging must have a simple pointer alternative as well as keyboard support: [W3C dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).

### Backgrounds and motion

- Support solid colors, validated gradients, images, and optional video backgrounds on pages/sections/containers. Provide crop/fit/focal-point, overlay, opacity, and responsive controls. Resolve all media through the host asset adapter, preserving the existing clean/approved media rules.
- Video backgrounds use a poster fallback, muted inline playback where permitted, and pause when offscreen. Respect reduced motion and data-saving preferences where available. Static page content must remain usable when playback is blocked or fails.
- Provide restrained entrance, hover, and section transition presets with duration, delay, and easing controls. Default to no entrance animation; ordinary content remains visible if enhancement fails. Use opacity/transform for initial motion effects, respect reduced motion, and offer a page-level motion disable switch.
- Keep animations in CSS/browser-native capabilities where practical. Do not load the editor, drag engine, a heavyweight animation runtime, or optional free-form tools on ordinary public pages. Preserve the existing 3D/poster progressive-enhancement contract only for templates that explicitly use it.

## Shareable review links and Figma-style comments

Proposed workflow:

1. Save the draft and create a specific review snapshot. Unsaved edits must be saved successfully before producing its review URL.
2. Generate a high-entropy, expiring, revocable review link scoped to one tenant, website/page, and snapshot. Store a hash of the secret. The host controls separate view and comment capabilities.
3. A reviewer opens the link, enters a display name, and clicks a visible element to start a thread. The name is self-entered, not a verified identity. The capability grants no editing, publishing, workspace, checkout, or RSVP rights.
4. Store the thread anchor as snapshot ID + stable node ID + optional field/item ID + normalized position inside the node. Record the viewport width; do not anchor only to document pixel coordinates or an arbitrary CSS selector.
5. Show numbered pins and a thread panel, with replies, open/resolved state, and an accessible list for keyboard users. Comment mode suppresses action widgets. A new revision does not silently move earlier comments onto different content; show the reviewed revision and offer a deliberate new review link.
6. All comment writes and reads recheck share scope, expiration/revocation, tenant access, snapshot, and asset authorization. Guest comments are untrusted text, have length/rate limits, and are never injected as HTML or mixed into public event wishes.

Review routes must send no-store/private responses, no-index directives, and a restrictive referrer policy. Exclude raw review secrets from analytics/logging; scrub access logs for review paths. Where practical, exchange the initial secret for a scoped secure cookie and remove it from the visible URL. Shared draft media needs equally scoped access; a draft image must not become globally public merely because it is shown in a review.

No realtime infrastructure is required for the first version: persist comments in the existing database and refresh/poll the thread list. Live cursors, presence, email notifications, and cross-project collaboration remain separate possible additions. Optional constrained free-form positioning is now included in the visual-editor plan above; unrestricted whole-page absolute positioning is not the default layout model.

## Recommended extraction sequence

1. Prove a single canonical template and editor mounting across Vue and React, including public SSR and preview parity. Define nested document nodes, stable IDs, semantic theme tokens, and document/data/action contracts.
2. Deliver the canvas-first editor, element/template libraries, inline text editing, undo/redo, responsive controls, and structured drag arrangement. Keep live-connected fields distinguishable from fixed copy.
3. Deliver brand import, curated palettes, typography, contrast checking, backgrounds, and motion controls through shared registries and inspectors.
4. Add constrained free-form sections behind an optional capability; enable only after automated responsiveness and interaction-performance evidence is satisfactory.
5. Introduce shared revision/publication/review services and guest comments, with tenant authorization injected by the host. Keep the active publication available while drafts change.
6. Integrate PixelCore storefront composition and migrate its existing page/branding references without losing IDs, revision history, public URLs, or commerce routes.
7. Give event website content independent snapshots and publication while leaving event operations and RSVP authorization in scheduling. Migrate existing event templates/media and preserve public/private invitation routes.
8. Integrate Medframe using its existing GraphQL administration, optimistic version checks, publication review, approved media restrictions, public URLs, and queue policy.
9. Publish compatible package releases, installation/migration documentation, and a host-adapter contract for DineEase/future projects. Validate DineEase only when its implementation is available.

Prefer staged integration and a temporary compatibility adapter over deleting either existing website system during the first extraction. The acceptance target is equivalent website functionality through the shared packages, not two permanently maintained rendering paths.

## Verification requirements for implementation

- Core tests: schema validation/migrations, stable IDs after reorder, binding allowlists, safe text/URL rendering, missing entities, and deterministic snapshots.
- Backend tests: tenant isolation, draft/public separation, old review survival after a newer save, expiry/revocation, view-only versus commenting permissions, snapshot-specific threads, guest display-name handling, concurrency/version conflicts, and safe asset access.
- Adapter tests: REST and GraphQL error behavior, identical resolved content across both renderers, SSR content present without editor JavaScript, proper event-listener disposal, and blocked preview business actions.
- Migration tests: existing page/event URLs and private invitation token behavior retained, all template variants represented, business appearance preserved, and rollback feasible.
- Visual-editor automated tests: inline text/IME/paste handling, undo/redo, add/duplicate/remove operations, drag and non-drag equivalence, invalid nesting, zoom coordinates, breakpoint overrides, missing live bindings, save conflicts, and preservation of stable IDs.
- Theme/media automated tests: branding import validation and undo, preset completeness, typography inheritance, exact contrast threshold boundaries and indeterminate backgrounds, media fallback, reduced motion, and optional-runtime loading boundaries.
- Free-form automated tests: bounded positioning, snapping/resizing, DOM reading order, mobile fallbacks, pointer cancellation, a single undo/persistence commit per drag, and interaction performance against a recorded environment/baseline. Do not claim the feature is lightweight without measurements.
- PixelCore frontend changes require `npm run check:ui` and focused automated tests. Backend changes require focused automated tests. Do not run builds unless explicitly requested. Browser inspection was requested for this audit; any later visual verification remains subject to the user's verification policy.

## Audit validation and limitations

Jev evaluated only generic architectural requirements without source data, secrets, account details, or business records; it favored the portable installed-module boundary. This is advisory, not implementation evidence.

Graphify first queried the existing graph, then structurally extracted a task-scoped graph of 14 PixelCore website files (~24,109 words): 595 nodes and 1,024 edges, with no LLM extraction tokens. The scoped graph is in ignored `graphify-out/website-builder/graph.json`. Traversal used vocabulary present in that graph: page, revision, preview, publish, website, manifest. Inferred graph relationships were checked against the actual source.

This audit adds documentation only. No product code, application schema, website content, dependency, external repository, or release was created or changed. No application build was run. DineEase behavior and future hosts remain unverified.
