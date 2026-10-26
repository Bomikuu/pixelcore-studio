# Website studio redesign and wedding integration plan

Status: implementation delivered, 2026-10-23; acceptance evidence and remaining limits are recorded below. The user's supplied screenshot replaces the previous light editor direction as the approved visual authority. Implementation authorization selected the described in-product context flow.

## Outcome and visual direction

Business owners should assemble an attractive site from finished, responsive sections and their actual system data. The first viewport must show a useful, large page canvas with its real header and footer, an intelligible layer tree, and contextual properties. Opening a library should feel like choosing a designed component, with real previews and variants.

Reference: [user-supplied editor screenshot](../references/editor-workspace-reference.png). Use its near-black workspace, restrained borders, slim tool rail, page/layer navigation, generous canvas, blue selection, and grouped inspector. Preserve readable 12–14px chrome text and accessible hit areas rather than copying the screenshot's tiny controls. Website typography and colors remain independent of editor chrome. Reference imagery, furniture branding, and text are not product assets to copy.

Recommended approach: redesign the existing editor shell and add a registered section/widget library on the proven document/revision foundation. A cosmetic reskin alone leaves the missing workflows unresolved. Replacing the entire engine would discard working inline editing, history, validation, and reviews without addressing host integration faster.

The current implementation is an initial functional foundation, not the finish standard for this redesign. Do not call it polished based solely on passing syntax or DOM checks.

## Evidence from the current implementation

- `packages/editor/src/mount.js` places Elements and Templates inside the left rail; template thumbnails are colored title swatches. Move both libraries to dedicated modal pickers with rendered previews.
- `packages/renderer/src/templates.js` has four page templates, twelve primitive/data elements, and only two section presets. There are no registered header, footer, or RSVP elements.
- PixelCore `components/site/StorefrontPage.vue` renders native header/footer, global hero, closing sections, popup, and cart outside the builder document. The studio does not currently preview that complete frame. Marketplace storefronts use another frame.
- PixelCore `pages/event/[eventId]/rsvp/[token].vue` loads a private invitation and renders `components/event/EventRsvpResponsePage.vue`. That component already has preview mode, response confirmation, party size, dietary/accessibility notes, and guest messages.
- `PublicEventRsvpView` and `PublicRsvpSerializer` own invitation authorization, response deadlines, event status, party-size rules, capacity, existing replies, and the audit trail. Keep those authorities in PixelCore.
- Builder documents currently represent individual pages; Pages navigation needs a host-backed workspace contract. A page list with invented URLs would not be functional integration.

## 1. Context before template selection

Interpretation awaiting clarification: the product should ask for context in a short setup flow, rather than requiring the owner to explain their system repeatedly.

New website sequence:

1. **Purpose:** storefront, wedding/event, or landing/information site. Choose Live data or Fixed content with concrete examples. A live site may still contain fixed editorial copy.
2. **Source:** select an existing business/store/event. Prefill active business and the event when opened from its Website tab. Show the connected source and a Change action. Do not silently create operational records.
3. **Starting point:** continue the current site, use a compatible template, or start blank. For an existing publication, default to continuing it; create a draft before replacing anything.
4. **Brand and features:** review imported logo/colors/fonts; choose supported features. A wedding shows schedule, venue, RSVP, gallery, and approved wishes; a store shows products, collections, cart, and contact. Retain native header/footer by default.
5. **Open studio:** use actual approved data. If a required image or source is missing, explain it and offer host media selection or a different layout. Example content is explicitly labeled and is never published as real business information silently.

Keep it to three short screens by combining purpose/source and brand/features. Returning users open their saved workspace immediately, with context available under Site settings. Changing website context creates an explicit migration/compatibility step rather than breaking bindings in place. Standalone demo asks the same questions against clearly labeled examples.

## 2. Modern workspace composition

- **Top bar:** back to host, site/page name and saved state; central desktop/tablet/phone and canvas width/fit; undo/redo, review/share, preview, and one primary Publish action. Group occasional settings in an accessible overflow menu.
- **Slim left tool rail:** Pages/layers, Add, Templates, Media, Theme, Site settings. Use one consistent SVG icon set, accessible names, tooltips, active indicators, and keyboard access.
- **Left panel:** Pages and Layers; searchable, collapsible tree with real nesting, visibility, selected element, and named sections. Page switching uses host routes/data and protects dirty drafts. On narrow desktop widths it can collapse to the tool rail.
- **Center:** the full website at a useful fit, including header/footer; selection outline and label, insertion lines, section controls, and a small contextual toolbar. Double-click text to edit. Suppress a canvas-selection rerender while the owner is typing or composing text.
- **Right inspector:** selection-specific groups: Layout, Size/alignment, Typography, Colors/background, Border/effects, Motion, Data connection. Show useful controls first and advanced controls on disclosure. Page selection shows site/page settings. Operational settings link to their existing host editor.
- **Persistent feedback:** small saved/saving/offline/conflict indicator; actionable errors. Destructive replacements show a change summary. Undo remains available after insertion, moving, deletion, and style changes.

Proposed desktop geometry: 52px top bar, 48px tool rail, approximately 248px left panel and 288px inspector, flexible center. Panels resize/collapse; their minimum widths must not force horizontal page overflow. No marketing heading or large explanatory cards above the editing workspace.

## 3. Template and Add popups

Two explicit entry points:

- **Templates:** a large modal with purpose/category filters, search, authored thumbnails, and a detail preview with desktop/mobile views. Display which data/features it needs. Actions: Apply to this page, or Create page when the host supports it. Template replacement preserves the old revision, asks about existing content, reports missing connections, and is one undoable change. Never replace other pages/header/footer as an unnoticed side effect.
- **Add:** a large modal with tabs **Sections**, **Elements**, and **Saved**. Searchable categories and visual cards. Selecting a card opens its variants and a real responsive preview. Choose Insert below selection, Inside selected container when valid, or a specific insertion point. Hovering never modifies the document; Cancel changes nothing. Return focus to the inserted element on success.

On desktop the dialogs occupy up to approximately 1120px with a category column and preview grid; on phones use a full-screen dialog with a single preview column. Escape closes, focus stays inside, scroll positions are retained, and background keyboard/drag actions stop while a dialog is open. Load thumbnails and detailed previews on demand rather than mounting every template at once.

## 4. Premade library: launch scope

A primitive is a small building block. A section is a composed, responsive layout with finished spacing, typography, image treatment, and mobile behavior. A template is a cohesive page/site composition using the same sections. Saved user sections are independent copies in this pass; do not imply edits synchronize across sites.

| Category           | Premade sections and variants                                                       | Data / behavior                                                                     |
| ------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Header/navigation  | Logo left, centered logo, compact wedding monogram; normal/sticky where appropriate | Existing host logo, navigation, cart/account actions; mobile menu                   |
| Footer             | Compact, multi-column, wedding sign-off                                             | Existing business contact, social/policy links; no duplicate footer                 |
| Hero               | Editorial split, full-bleed image, centered invitation, compact title               | Fixed or connected title/date; image focal point; clear CTA                         |
| Content            | Image + text, alternating story, two/three-column features, quote/testimonial       | Fixed copy; only actual supplied testimonials                                       |
| Media              | Image with caption, two-image story, responsive grid, gallery, video/poster         | Host media library, alt text, aspect ratios, poster/reduced-motion handling         |
| Collections        | Product grid, featured collection, service cards                                    | Approved live catalog, real links/prices; fixed curated IDs can remain live records |
| Event details      | Couple introduction, participants, story timeline, event countdown                  | Registered public-safe event fields; correct event timezone                         |
| Programme/location | Schedule cards/timeline, ceremony + reception, venue address/map link               | Existing schedule and venue records; map link first, heavy embed optional           |
| Guest information  | Dress code, travel/accommodation, FAQ, gift information                             | Existing event content where supported; explicit fixed copy otherwise               |
| RSVP               | Inline card, image + form split, RSVP call-to-action                                | PixelCore RSVP capability and invitation context, as below                          |
| Guest book         | Approved wishes grid/list                                                           | Publicly approved messages only; distinct from private review comments              |
| Conversion/contact | CTA strip, contact details, hours/location, social links                            | Host-approved links; contact form only when a host submission capability exists     |
| Layout primitives  | Heading, paragraph, image, button/link, divider, spacer, container, columns/grid    | Inline editing; fluid layout, gap/padding, element-level overrides                  |

First template set: **Storefront editorial**, **Storefront compact**, **Wedding editorial**, **Wedding garden**, **Landing minimal**, **Landing image-led**. Each includes a deliberate header/body/footer composition and a tested mobile design. Reuse existing legitimate assets; produce missing assets through the image skill during implementation rather than placeholder gradients. Existing templates/documents remain readable during migration.

Capabilities filter the library. Show a disabled explanation for an unavailable requested feature, such as “Connect an event to use RSVP.” Never insert a widget that cannot work. Saved sections with unsupported capabilities show the same compatibility check.

## 5. Header and footer ownership

PixelCore already owns storefront navigation, cart behavior, marketplace frame, policy links, and global regions. The studio must reveal those existing regions, not append decorative replacements inside the content body.

- Model **Header**, **Page content**, and **Footer** as distinct layer regions. Identify site-wide regions with a Global label and show which pages a change affects.
- For existing stores, keep header/footer host-managed. The editor displays host-rendered inert previews from the same component/presentation contract used on public pages. Clicking selects the region and offers supported appearance/variant controls plus Edit navigation in PixelCore.
- Make updates to global variants/styles explicit draft changes. Introduce a versioned site-layout revision, with publication/review snapshots referring to the exact header/footer configuration. Page-only publication does not publish unrelated pending global changes; publishing a global change lists affected pages. Existing current host layouts remain the fallback until migrated.
- For new fixed landing or wedding sites without host-owned chrome, use builder-managed header/footer sections with the same named region contract. At most one header/footer region per layout; no silent duplication with the native frame.
- Inventory global hero/banner/closing/custom-section/popup as well. Expose retained regions and visibility in the frame model; do not leave a second native hero or closing section invisible in the studio but visible on the public page.
- Preserve cart, checkout, account, booking, policy, and private invitation routes. An editor's site header is separate from the tool's own top bar.

## 6. Wedding RSVP integration

Use a **registered host widget** (`pixelcore.event-rsvp`) with editable placement and appearance. Reuse the existing response form/controller; do not create a second guest database, generic form endpoint, or competing attendance workflow.

**Editor behavior:** context connects an existing event. Add → Event → RSVP offers the three layouts above. The inspector controls display copy, spacing, colors and layout. Response fields, deadline, maximum party size, Maybe, and confirmation settings show their current source and link to PixelCore's RSVP settings. Style saves do not alter those operational settings. Use an obvious synthetic guest and existing preview-mode behavior; simulate states locally without requests that write responses.

**Public behavior:**

- Public `/event/:eventId` shows the published invitation. An anonymous visitor gets an RSVP prompt explaining that a private invitation link is required; it never chooses a guest or shows a guest list. The existing `public_rsvp_enabled` flag currently controls response availability and does not by itself create anonymous registration.
- Existing `/event/:eventId/rsvp/:token` remains the invitation entry point. After the host validates that token, show the same published composition with the RSVP widget at its selected position and focus/scroll to it. Reuse `GET/PATCH /api/public/events/:eventId/rsvp/:token/` and update the existing `EventGuest` record. Preserve the legacy response page as fallback until the shared path passes compatibility tests.
- Keep the token and guest state in host request/session context, never in the document, reusable templates, media URLs, analytics events, or review snapshots. Set private/no-store/no-index/no-referrer responses for personalized invitations and their payloads. Do not cache personalized widget output as a public page fragment.
- Respect event open/closed status, timezone/deadline, enabled/disabled form settings, existing response, permitted Maybe, party limits, total capacity, errors/retry, and accepted/declined confirmations. Reuse current seating/invitation links without making private assignments public.
- Publishing an RSVP block must not reopen responses or enable a disabled event. Detect a missing connected source before publishing.

**Preview/review behavior:** render an inert form or local simulation with a sample guest. No guest token, dietary/accessibility notes, private messages, or seating data enters a share snapshot. Guest review comments remain a separate feature. Review links never grant RSVP submission rights.

**Widget architecture:** shared renderer returns stable widget markers/descriptors; a registered host renderer supplies approved server markup and mounts/unmounts its interactive component in public mode. The document stores only widget ID, validated presentation settings, and source reference. Vue/React adapters provide equivalent extension contracts; only PixelCore implements this RSVP widget now. Editor/review rendering uses an approved inert presentation, with no injected scripts or arbitrary HTML in a website document. Frozen widget presentation participates in review snapshots and withdrawn-media checks.

## 7. Responsive behavior

- **Published pages:** mobile-first normal flow; stacked columns on phones, bounded content width, adaptive headings and padding, deliberate image crops, touch-friendly navigation, no fixed-height text clipping. Provide desktop/tablet/phone overrides with clear inheritance/reset. The preview uses the actual viewport width; zoom is an editor transform.
- **Editor:** full three-panel workspace on wide desktop; collapsible rails on smaller laptops/tablets; one canvas plus temporary tool/property sheets on phones. No claim of full desktop editing parity on phones; supported actions, history, save, preview, and publish remain reachable.
- **Components:** each preset defines stacking/order, alignment, gap, minimum readable type, media ratio/focal point, long-copy behavior, and loading/error/empty states. Touch dragging always has move/insert alternatives. RSVP works with long guest names, translated labels, the on-screen keyboard, submission errors, and browser zoom.
- **Motion/performance:** restrained chrome transitions, opt-in content effects, reduced motion, poster fallback, lazy library previews. Public pages import only the widgets they use. Free positioning stays disabled until the separate responsiveness/performance gate passes.

## 8. Implementation sequence and proof

All work below is proposed, not complete. Preserve no-build and automated-check-only policy. Planning does not change live pages or authorize a registry release. Visual acceptance against the supplied reference remains an explicit later check; automated semantics cannot certify polish.

### A. Context/workspace and region contracts

Files: shared `packages/core/src/document.js`, `index.d.ts`, Python validation/models/migrations; new `packages/editor/src/workspace/context.js`; PixelCore `content/builder_bridge.py` and `pages/workspace/site/builder.vue`.

- [ ] Define versioned `WorkspaceContext` (purpose, mode, tenant/source reference, capabilities, region ownership, page list); host `loadWorkspace/listPages/createPage` only where supported.
- [ ] Add source-prefilled setup/continue flows, missing-source feedback, cancellation/resume and dirty-page switching protection.
- [ ] Define site-layout revision/publication/snapshot references and migrate old documents additively; retain current publications.
- [ ] Automated proof: prefilled event, blank site, forbidden/cross-tenant source, returning draft, unsupported capability, old-document loading, and global-vs-page publication isolation.

### B. Editor shell and library dialogs

Files: `packages/editor/src/mount.js`, `workspace/styles.js`, `tokens.js`, `components/ui/index.js`; new `library/` modules; `DESIGN.md` and `.impeccable/surfaces/editor.md`.

- [ ] Replace editor visual system with the reference-based dark workbench. Record actual tokens, panel behavior, and typography in DESIGN; do not darken published sites.
- [ ] Implement Pages/Layers, contextual inspector and selection toolbar; preserve inline text, IME, history, conflicts, export, review and publication.
- [ ] Implement separate Template/Add modal pickers with preview/detail/variants, focus/escape, lazy loading, valid insertion and replacement summary.
- [ ] Automated proof: keyboard dialog lifecycle, cancellation, insertion/history, selection persistence, source badges, unsaved/conflict states, and bounded layout rules.

### C. Finished responsive presets and templates

Files: split `packages/renderer/src/templates.js` into a registered `library/`; core/renderer schemas/styles; editor library panels; relevant Python validators.

- [ ] Implement the launch inventory above in reusable presentation primitives; declare capability requirements, stable preset IDs/versions, approved previews, responsive defaults, and migration behavior.
- [ ] Add all six composed templates with intentional assets/content, real source mapping, and mobile variants. Disable missing-source actions with guidance.
- [ ] Automated proof: every preset validates/renders, fresh IDs per insertion, required capability filtering, inherited/reset overrides, long content/empty data, safe URLs, alt text, and contrast findings.

### D. Actual header/footer and frame parity

Files: shared renderer/adapter region contracts; PixelCore `components/site/StorefrontPage.vue`, `components/site/StorefrontHeader.vue`, `StorefrontFooter.vue`, marketplace frame and event presentation components; backend bridge/revision hooks.

- [ ] Inventory and adapt host regions, then render them in the studio using their real presentation contract. Add explicit global scope and supported settings.
- [ ] Bind public/editor/review to the same effective frame/layout version; preserve marketplace, hero/banner/popup/cart/closing behavior without duplicate regions.
- [ ] Automated proof: exactly one header/footer/main landmark, native cart/navigation compatibility, global revision isolation, review snapshot stability, page switching, and legacy publication fallback.

### E. Registered widgets and existing RSVP

Files: new shared renderer widget registry/descriptors, Vue/React adapter widget hooks; PixelCore `components/event/EventRsvpResponsePage.vue` (extract reusable form/controller), new `EventRsvpWidget.vue`, existing public event/RSVP routes; backend bridge and scoped scheduling tests.

- [ ] Define allowlisted widget registration, inert preview renderer, public hydration/disposal, error fallback, and snapshot projection.
- [ ] Mount the existing RSVP workflow in the shared composition at the chosen location; retain old routes and fallback.
- [ ] Automated proof: valid/invalid/replaced token, no token, disabled/closed/deadline, previous response/Maybe, party-size/capacity, double-submit/error retry, confirmations, source/tenant isolation, and no writes or private guest data in review mode. Preserve the current backend rules; record concurrency gaps separately if existing capacity handling needs hardening.

### F. Integration, regression and acceptance record

- [ ] Run scoped shared JS/Django tests, declaration contracts, template/widget snapshot tests, semantic accessibility checks, premium audit, official DESIGN lint, and PixelCore `npm run check:ui`. No application/image builds.
- [ ] Check legacy documents/URLs and native editor switching; verify old review links and withdrawn assets, and assert public entries exclude editor/library runtime.
- [ ] Record which viewport/drag/visual criteria remain unverified under current policy. Request visual checks only as a separate explicit scope; do not label the redesign visually accepted from static checks.
- [ ] Update adapter docs and plan status. Leave Medframe activation deferred and protected DineEase source untouched.

## Planning assumptions and decisions to confirm

- The supplied dark workspace is the editor reference; page/template themes remain independently selectable.
- “Ask for context” currently means in-product setup with known details prefilled; a clarification has been requested.
- Wedding response submission stays invitation-only, consistent with the existing endpoints. Open self-registration would be a separate product decision and API capability.
- Existing site-wide regions are retained and made visible first; replacing them is explicit. The plan does not silently make headers/footers ordinary duplicated page blocks.
- This plan replaces the old editor's visual/workflow direction while preserving valid data and revision history. No implementation or visual certification is claimed in this document.

## Delivery record

- [x] Implemented the dark workbench, slim SVG tool rail, Pages/Layers, collapsible tree/search, contextual properties and responsive panel switching.
- [x] Implemented separate Template/Add dialogs, real renderer previews, search/category filtering, responsive detail previews and eight-card lazy batches.
- [x] Added six composed templates, 36 section presets, primitives, validated widgets and tenant-scoped saved sections. All presets validate and render; template CTAs have matching section anchors.
- [x] Added source-prefilled context setup; one undo restores a template replacement. Existing documents and live publications remain intact.
- [x] Added global header/footer representation and separate site-wide draft/publication streams; actual native commerce navigation/cart/footer behavior is retained. Page publication does not publish a pending frame draft. Reviews freeze the frame revision.
- [x] Mounted the existing invitation-authorized RSVP workflow in the published event composition; review mode remains inert. Missing event contexts cannot publish RSVP/event widgets.
- [x] Automated frontend/backend/HTTP checks, declaration checking, syntax, formatting, Shadcn boundary and design audits were run; see verification.md.
- [ ] Browser visual acceptance, touch/drag measurements and full mobile accessibility remain unverified under the user's current automated-check-only policy.

Native region previews summarize approved content/settings; mega-menu interactions, advanced hero/3D, native custom sections and popup timing continue in their existing PixelCore surfaces. The global frame inspector deliberately exposes only implemented native variants, colors and header spacing. The optional free-form module stays disabled. Saved-section copies do not synchronize. Medframe activation and registry/remote publishing remain deferred.
