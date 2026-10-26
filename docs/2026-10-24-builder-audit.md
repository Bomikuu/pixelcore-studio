# Website builder audit and recommended additions

Date: 2026-10-24. Scope: the shared builder at `/home/micxsz/projects/website-builder`, with selected PixelCore host integration sources.

## Verdict

The implementation has a coherent editor/renderer/host boundary and useful working foundations. It is ready for another focused development pass, with correctness and recovery work ahead of broader rollout. The highest-value product addition is a visual data-binding and repeater workflow: design one layout, populate it from the host system, and reuse it across live records.

This audit changed documentation only. Source inspection and automated DOM/assertion checks were used. No application builds, screenshots, browser inspections or manual visual verification ran. Visual polish, touch interaction, actual layout at zoom, browser font availability and browser performance remain unverified. The scores below describe technical evidence and gaps, rather than accessibility certification or visual approval.

## Technical health

| Dimension                | Score / 4   | Evidence and limitation                                                                                                                                                                                                                            |
| ------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility            | 2           | Semantic control checks pass, labels/dialogs/non-drag controls exist; the contrast classifier can falsely pass small headings, and canvas shortcuts are incomplete. Screen-reader and full browser coverage are outstanding.                       |
| Performance              | 2           | Public entries exclude the editor; images are lazy-loaded and optional runtimes are separated. Each ordinary edit rewrites the iframe; template listing returns every complete document. No browser latency measurements exist.                    |
| Responsive design        | 2           | Device previews, CSS breakpoints and normal-flow mobile layouts exist. Breakpoint order can override phone styles, and some responsive properties are accepted but not rendered.                                                                   |
| Theming                  | 3           | Semantic tokens, global primary/secondary fonts, brand imports and schemes are implemented. The font menu exceeds the fonts supplied by the standalone renderer.                                                                                   |
| Implementation integrity | 3           | Validated operations, immutable revisions, tenant authorization, inert review widgets and shared rendering are implemented. Recovery and template lifecycle are incomplete; publication failure handling diverges from the shared dialog contract. |
| **Total**                | **12 / 20** | **Acceptable foundation; significant work remains.**                                                                                                                                                                                               |

Nine findings: **0 P0, 3 P1, 6 P2, 0 P3**. Some are verified defects; recovery, library lifecycle and performance scaling are explicit readiness gaps. No active production data loss or measured browser slowdown is claimed.

## Existing strengths to preserve

- One canonical renderer, with Vue and React adapters and isolated editor/review runtimes.
- Six templates, 36 section presets, popup libraries, inline plain-text editing, stable identities and undo/redo.
- Global heading/body font families with prohibited element-level family overrides.
- Live host data, protected connected text and source navigation, with host-owned operational actions.
- Draft/public separation, immutable revisions, optimistic version checks and saved review snapshots.
- Named guest comments, replies and resolution, expiring/revocable review capabilities and host media revalidation.
- PixelCore invitation-authorized RSVP is reused; editor/review cannot submit guest responses.
- Tenant-scoped saved sections/templates, validated JSON import and template export.

## Findings

### F1 — P1: Responsive output depends on edit order

Location: [render.js](/home/micxsz/projects/website-builder/packages/renderer/src/render.js:85), [inspector inheritance](/home/micxsz/projects/website-builder/packages/editor/src/inspectors/index.js:86). Category: Responsive Design. Verified through generated CSS assertions.

A node with `responsive = { phone: { padding: 12 }, tablet: { padding: 60 } }` emits the 600px rule before the 960px rule. At a 390px viewport both rules match, have equal specificity and the later tablet rule wins. Editing phone first and tablet later can produce this order naturally. The inspector also combines desktop with the current breakpoint only, omitting inherited tablet settings on phone.

A related renderer contract gap: responsive `height` is accepted, but a spacer with desktop height 40 and phone height 100 still emits inline height 40 and no phone height 100. Motion is also selected from desktop styles despite breakpoint-aware inspector writes.

Recommendation: a shared deterministic style resolver with desktop → tablet → phone precedence. Emit wider media rules before narrower rules. Resolve effective inspector values through the same chain. Either implement responsive height/motion or explicitly disable unsupported controls/properties. Cover edit-order permutations and supported properties. Suggested command: `$impeccable adapt`.

### F2 — P1: Contrast can falsely pass a small heading

Location: [theme.js](/home/micxsz/projects/website-builder/packages/core/src/theme.js:195), [rendered scale](/home/micxsz/projects/website-builder/packages/renderer/src/render.js:215). Category: Accessibility. Verified through renderer/core assertions.

With `baseSize: 12`, `scale: 1`, and an unstyled H1, both rendered H1 bounds are 12px. The contrast checker assumes 40px for H1. `#777777` on white has a ratio of approximately 4.478:1: it fails the 4.5:1 requirement for small text, but `contrastFindings` reports no issue because it treats this as large text. The inspector can consequently show a pass and publication readiness can omit the problem.

Recommendation: derive the checker’s type metrics from the same scale, heading level, inheritance and breakpoint rules as rendering. Fluid text needs a conservative supported-size check or an explicit indeterminate result. Include native/widget text in the wider accessibility workflow. [W3C’s contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) distinguishes normal and large text thresholds. Suggested command: `$impeccable harden`.

### F3 — P1: Unsaved draft recovery ends with the page session

Location: [save-state.js](/home/micxsz/projects/website-builder/packages/editor/src/workspace/save-state.js:1), [unload protection](/home/micxsz/projects/website-builder/packages/editor/src/mount.js:989). Category: Implementation Integrity. Source-verified readiness gap.

Pending documents live in memory. There is unload protection and manual export, but no durable recovery store. After a failed save, a crash or confirmed reload cannot restore the unsaved document. Existing immutable server revisions protect successful saves only.

Recommendation: bounded local recovery for document content, scoped to user/tenant/website, with expiry and cleanup at logout. Exclude resolved host-data snapshots and private guest state. On recovery, show the server version and offer restore/export/discard; never bypass optimistic conflicts. Add a revision-history/restore workflow separately. Suggested command: `$impeccable harden`.

### F4 — P2: Failed publication closes its retry context

Location: [publish handler](/home/micxsz/projects/website-builder/packages/editor/src/mount.js:261), [modal](/home/micxsz/projects/website-builder/packages/editor/src/components/ui/index.js:75). Category: Implementation Integrity. Reproduced with a rejected host publication in Happy DOM.

The publish handler catches an error and reports it to the status bar without rethrowing. The shared modal sees a successful resolution and closes. The error remains available in the status bar, so this is recoverable, but the user loses the confirmation context and must reopen it. The modal’s own confirmation button also has no pending guard.

Recommendation: keep the confirmation open on failure, display its inline error and provide a busy/disabled confirmation while publishing. Add duplicate-click and failure/retry coverage. Suggested command: `$impeccable harden`.

### F5 — P2: Saved template/section lifecycle has no cleanup

Location: [template endpoint](/home/micxsz/projects/website-builder/python/website_builder/views.py:167), [routes](/home/micxsz/projects/website-builder/python/website_builder/urls.py:3). Category: Implementation Integrity. Source-verified feature gap.

The libraries support listing and creation, with a 100-item limit. There is no shared update, rename, archive/delete or replacement endpoint/UI. Users can fill the library with experiments and then have no in-product way to free space. Saved copies do not synchronize when the original changes.

Recommendation: add rename, duplicate, archive/delete, tags and version information, then distinguish a copied section from a linked global component. Check references before deleting anything linked. Preserve old immutable revisions and reviews. Suggested command: `$impeccable shape`.

### F6 — P2: Valid website exports with long titles fail template import

Location: [template.js](/home/micxsz/projects/website-builder/packages/core/src/template.js:72). Category: Implementation Integrity. Reproduced with a valid 120-character page title.

Website titles allow 180 characters, but raw document import reuses the title as a template name limited to 100. A legitimate exported page with a 101–180-character title is rejected before the user can rename it in the import form.

Recommendation: decouple the imported document title from its proposed template name. Supply a shortened editable default or prompt for a valid library name while retaining the parsed document. Suggested command: `$impeccable harden`.

### F7 — P2: Font selection has no availability contract

Location: [font choices](/home/micxsz/projects/website-builder/packages/core/src/theme.js:101), [bundled fonts](/home/micxsz/projects/website-builder/packages/renderer/src/fonts.js:1). Category: Theming. Source-verified integration gap.

The menu includes Newsreader, Bodoni Moda and Italiana, but the standalone renderer supplies Manrope and Cormorant Garamond only. Some other choices are intentional system fonts. Host applications may supply more fonts, but the menu does not describe availability or require a matching font registry. Unsupported local families can fall back, and SSR hosts own font loading independently.

Recommendation: a shared licensed font registry with family/weights/source metadata and explicit host support. Offer bundled fonts and available system families; expose extra families only when configured. Test editor/public font configuration parity. Keep the global two-family rule. Suggested command: `$impeccable typeset`.

### F8 — P2: Editing and library loading have scaling risks

Location: [render cycle](/home/micxsz/projects/website-builder/packages/editor/src/mount.js:953), [iframe rewrite](/home/micxsz/projects/website-builder/packages/editor/src/mount.js:824), [library payload](/home/micxsz/projects/website-builder/python/website_builder/views.py:190). Category: Performance. Source-verified risk; no measured browser slowdown.

Committed edits rebuild the rail, inspector and iframe document. This can reset scroll/focus and media state and becomes expensive as pages grow. The library endpoint returns up to 100 complete documents. At the accepted maximum of 500 KB each, document content alone can approach 50 MB; loading eight visual cards per batch does not limit that network payload.

Recommendation: preserve selection/scroll and patch affected nodes where practical. Use metadata pagination and lazy document fetching for template details. Add browser interaction budgets later under explicitly authorized visual/performance verification. Keep free positioning gated until measured. Suggested command: `$impeccable optimize`.

### F9 — P2: Save shortcuts do not reach the canvas

Location: [canvas key handler](/home/micxsz/projects/website-builder/packages/editor/src/mount.js:843), [chrome key handler](/home/micxsz/projects/website-builder/packages/editor/src/mount.js:983). Category: Accessibility. Reproduced with DOM keyboard events.

Ctrl+S in editor chrome saves the draft and prevents the browser default. The same event inside the iframe canvas does neither; the document boundary prevents it from reaching the shadow-root listener. Save remains available through the toolbar, but the shortcut is inconsistent precisely where editing takes place. Undo also needs a deliberate distinction between native text editing and document operations.

Recommendation: one command router shared by chrome and iframe, with explicit IME, contenteditable, native text undo, modal and browser-default rules. Suggested command: `$impeccable harden`.

## Detector findings and audit limits

The premium strict audit reports zero findings. The scoped Impeccable detector reports three advisory values: two authored template colors in `library.js` and a 3rem content heading endpoint in `widgets.js`. These belong to template/public-content styling rather than editor chrome. They are not counted as product defects or evidence of visual incoherence. A future context maintenance pass can distinguish template palette/type ranges from editor tokens.

The existing Graphify map guided tracing; it predates the latest template additions, so source was checked directly. Jev received only a generic feature-gap summary and favored reliability/data workflows over additional effects. Its judgment is advisory.

## What to add next

| Order | Addition                                    | Concrete behavior                                                                                                                                                                                                                                                  | Relative effort |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| 1     | Recovery and version history                | Recover an unsaved document after a crash; browse dated revisions, compare draft/live and restore an old revision as a new draft.                                                                                                                                  | Medium          |
| 2     | Visual data panel and repeaters             | Choose a permitted record/collection, bind text/image/link/price fields and design one card for all products, services, team members or public event items. Add host-backed sorting/filtering/pagination and designed loading/empty/error states.                  | Large           |
| 3     | Linked global sections and component styles | Update a banner, CTA or card once across selected pages. Offer copy versus link, explicit detach, affected-page previews and versioned publication. Extend theme roles for buttons, cards and spacing while retaining two global font families.                    | Large           |
| 4     | Complete responsive layout controls         | Show inherited desktop/tablet values on phone, reset one property, hide/show per device, grid/stack alignment, independent padding sides, wrapping, fluid widths and min/max sizing.                                                                               | Medium–large    |
| 5     | Page settings and SEO                       | Description, social image/title, canonical URL, indexing controls, heading/alt checks and host-backed route/navigation settings. Derive structured Event/Product metadata only from actual approved records. Coordinate sitemap/redirect ownership with each host. | Medium          |
| 6     | Media workflow                              | Browse/search/upload through the existing host media API, choose crop/focal point/aspect ratio, edit alt text, inspect missing references and offer optimized renditions. JSON import should map missing asset IDs explicitly.                                     | Medium          |
| 7     | A stronger premade element library          | Accessible accordion/FAQ, tabs, feature and service cards, opening-hours/contact blocks, maps, video, responsive logo lists and galleries. Add lead/contact forms only with a host-owned submission contract, validation and spam controls.                        | Medium          |
| 8     | Review management                           | List active links, set expiry/view-only access, revoke in the editor, filter open/resolved threads, select the recorded viewport and jump between an editor node and its comments. Backend capability support already exists for parts of this.                    | Medium          |
| 9     | Context-specific template packs             | Landing, storefront and wedding/event packs with required data fields, compatible widgets, asset requirements and sensible empty states. Add template lifecycle before expanding the library substantially.                                                        | Medium          |
| 10    | Publication readiness and change summary    | Compare to live; report missing source/media/link targets, invalid heading order and unresolved contrast. Highlight global changes and which pages they affect. Preserve server authorization as authoritative.                                                    | Medium          |

“Medium” and “Large” describe relative implementation scope, not delivery promises.

Repeaters are particularly useful for the original request: design the storefront layout once, then let actual catalog records populate it. Wix documents the same reusable-item model in its [repeater workflow](https://www.wix.com/studio/academy/tutorials/how-to-use-repeaters). Linked global sections solve a separate need—changes propagating across pages—as described in [Wix’s global sections workflow](https://www.wix.com/studio/academy/tutorials/global-sections). These are functional reference points; the proposed data access and permissions remain host-owned.

For weddings, the data panel should expose permitted event title/date/venue, public schedule, approved story/media and registered RSVP widgets. Invitation identity, token, guest response and operational endpoints must continue to stay outside reusable templates and review snapshots. Operational reservations, checkout and clinical data remain host responsibilities.

Later additions can include approval roles, scheduled publishing, content localization, analytics event adapters and collaborative presence. Simultaneous collaborative editing and unrestricted free-form dragging add coordination/runtime costs; prioritize the structured editor and use measurements before enabling them. Medframe activation and registry publishing remain separate rollout decisions.

## Recommended execution order

1. `$impeccable adapt`: F1 breakpoint precedence and supported responsive properties.
2. `$impeccable harden`: F2 contrast correctness, F3 durable recovery, F4 publish retries, F6 import naming and F9 canvas command routing.
3. `$impeccable typeset`: F7 font registry and editor/public consistency.
4. `$impeccable optimize`: F8 incremental rendering and paginated library loading.
5. `$impeccable shape`: F5 library lifecycle, visual repeaters, revision history and linked global sections.
6. `$impeccable polish`: the completed flows after functional acceptance. Visual/browser verification requires an explicit request under the current project policy.

These can be requested individually, together, or in a chosen order. Re-run `$impeccable audit` after the fixes to reassess the findings.

## Verification run in this audit

- 37 shared JavaScript tests passed.
- 20 shared Django tests passed.
- Type declaration checks and source/public-entry checks passed (34 modules).
- Premium strict source audit: zero findings.
- Scoped Impeccable scan: three advisory values, no primary findings.
- Additional read-only assertions reproduced responsive rule order, ignored responsive spacer height, false contrast pass, failed-publication dialog closure, long-title import rejection and canvas shortcut isolation.

The passing suite does not cover all defects found here. The next implementation pass should convert these reproductions into focused regression tests while fixing the behavior. No application code, current page, database content, publication or external repository was changed by this audit.

## Implementation follow-up

Priorities 1–4 were implemented after this audit: scoped recovery/revision history with draft/live comparison; typed data bindings and repeatable cards; independently published linked sections; responsive inheritance/reset/layout controls. F1–F4 and F9 have fixes and regression coverage, including recovery lifecycle and publication retry behavior. See [verification](./verification.md) and [adapter contract](./adapter-contract.md) for exact behavior and limits. The original scores/findings above remain the point-in-time audit; no fresh visual score or WCAG certification is inferred. Template lifecycle, long-title import naming, extra font availability and broader editor/library scaling remain separate follow-up work.

## Priorities 5–8 implemented — 24 October 2026

- Saved templates/sections now support rename, tags, archive/restore and deletion with tenant authorization and optimistic versions. Template changes retain immutable versions; restore/export are available. F5's lifecycle/capacity limitation is addressed through deletion. F6's 180-character export/import title mismatch is fixed by suggesting a 100-character library name while retaining the full document title.
- Search/social metadata, canonical URLs and indexing are document settings wired to PixelCore public routes; host/private restrictions win. Page checks cover heading structure and alt text, without claiming accessibility certification. The host still owns routes and navigation.
- Native image upload uses validated, bounded raster processing, WebP renditions and existing PixelCore business storage. Media selection/search, missing-reference replacement and crop/fit/focal/decorative/alt controls are present. Standalone uploads use local demo storage. Linked sources remain separately editable. Video/caption authoring and remote media import are not added.
- Added FAQ, tabs, video, contact links, map/directions links, hours, logo lists and feature layouts. No-JS content, tab keyboard navigation and SSR parity have automated coverage. Contact forms await a host submission contract.

F7 (font availability) and F8 (whole-canvas re-rendering/full document library payloads) remain open. Free-form positioning still awaits explicitly authorized browser/performance verification. No build, browser visual inspection or screenshot evidence was produced for this pass.
