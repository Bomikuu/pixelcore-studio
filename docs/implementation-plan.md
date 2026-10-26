# Shared Website Builder Implementation Plan

> **For agentic workers:** Execute the reviewed plan task by task with checkbox tracking. No execution method has been selected, and this documentation update does not authorize delegation. Preserve the user's automated-check-only and no-build policy.

**Goal:** Deliver one installable, high-end website builder with a Wix-like editing workflow, reusable templates, live or fixed content, branding controls, and shareable previews with guest comments.

**Architecture:** One framework-independent document and rendering core, one embedded editor, thin Vue/Nuxt and React/Next adapters, and reusable Django persistence/review services. Host adapters supply approved actual data, assets, authorization, and domain actions. Use responsive structured layout by default and optional bounded free-form sections.

**Tech Stack:** Native ESM document/rendering/editor packages with TypeScript declaration contracts, native HTML/CSS rendering and progressive enhancement, Vue/Nuxt and React/Next host adapters, Python/Django persistence. Prove the shared renderer and editor integration before choosing additional UI or drag dependencies; do not fork template markup by framework.

**Spec:** [Implementation audit and expanded product requirements](./implementation-audit.md), including the Website modes and visual-editor requirements section.

**Status:** Requested product scope recorded on 2026-10-23. This is the master implementation plan; the shared-rendering proof precedes detailed module-specific plans and product code. The local repository has been created and implementation is active; see README.md and docs/verification.md for the actual delivery boundary. The first deliverable below resolves implementation-library choices with evidence instead of asserting untested compatibility.

## Global Constraints

- One separate maintained repository, proposed local path `/home/micxsz/projects/website-builder`; package scope/registry ownership must be available before release.
- PixelCore, Medframe, DineEase, and future projects consume releases through adapters. DineEase is unavailable locally and must remain untouched.
- Support **Live data** and **Fixed content** through the same editor/renderer, with per-element data connections and fixed-copy overrides.
- Public website routes must not load editor, drag, optional free-form, or review-only runtime code.
- Proposed interaction acceptance budget: on the same recorded desktop browser/device, a representative 100-element document must keep the 95th-percentile pointer-to-canvas update at or below 32 ms during dragging. Benchmark structured and free-form sections with the same assets and document size; report latency and memory, count persistence calls, and retain document correctness. This is a target to verify, not a measured result.
- Shareable previews use immutable review snapshots; guest reviewers enter a name without creating a system account.
- Use automated tests and targeted checks. Do not run frontend/backend builds or perform visual/manual verification without an explicit user request. PixelCore frontend integration still requires `npm run check:ui`.
- Preserve existing business authorization, approved media rules, commerce/booking/RSVP behavior, public URLs, private invitation routes, and publication history.
- Derive styles from semantic tokens. Host branding import changes the website draft, not global business settings, unless separately requested.
- Keep deployment independent of a new shared backend service. Package changes are maintained once and then installed/deployed by consumers.

## Review Focus

1. Inline edits to connected prices, titles, or event fields must not silently modify host records or detach their data connection.
2. Reordering, duplicating, nested drops, zoom, and breakpoint changes must preserve identity, semantic order, and review anchors.
3. Theme imports and photos/video behind text must not produce false contrast passes or silently replace brand colors.
4. Failed/offline saves and concurrent editing must preserve pending content; saving drafts must not unpublish the active website.
5. Old review links must remain tied to their reviewed content after further edits, while revocation and withdrawn asset permissions remain effective.

---

## File and ownership map

These are planned paths in the separate repository, not files created by this planning change:

| Path                                                                                   | Ownership                                                                     |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/core/src/document.ts`, `operations.ts`, `bindings.ts`                        | Versioned nested nodes, stable IDs, reversible operations, fixed/live values  |
| `packages/core/src/theme.ts`, `contrast.ts`, `brand-kit.ts`                            | Semantic theme, typography, contrast calculations, validated branding import  |
| `packages/renderer/src/render.ts`, `templates.ts`, `enhance.ts`                        | Canonical templates, server HTML, safe settings, optional client interactions |
| `packages/editor/src/mount.ts`, `workspace/`, `inline-text/`, `layout/`, `inspectors/` | Shared editor and all editing interactions                                    |
| `packages/freeform/src/`                                                               | Optional bounded positioning, snapping, resize, responsive fallback           |
| `packages/review/src/`                                                                 | Review viewer, pins, accessible thread panel                                  |
| `packages/vue/src/`, `packages/react/src/`                                             | Lifecycle, SSR, framework integration and host action slots                   |
| `python/website_builder/models.py`, `services/`, `tests/`                              | Django revisions, publication, review shares, guest comments                  |
| `examples/nuxt-host/`, `examples/next-host/`                                           | Minimal automated adapter compatibility fixtures                              |
| `docs/DESIGN.md`, `docs/UX-CONTRACT.md`, `docs/adapter-contract.md`                    | Builder visual/behavior rules and host integration contract                   |

Maintain focused files within directories rather than replacing the existing large event editor with another monolithic component. New-repository `AGENTS.md` must carry the user's tooling and verification policies. Host application UI continues to use its canonical Shadcn layer.

## Delivery tasks

### Task 1: Prove one shared renderer and editor boundary

**Files:** `packages/core/src/document.ts`, `packages/renderer/src/render.ts`, `packages/editor/src/mount.ts`, `packages/vue/src/`, `packages/react/src/`, both example hosts, and `tests/adapter-parity.test.mjs`.

**Interfaces:** `renderPage(document, resolvedData, { mode, baseUrl }) -> { html, head, assets }`; `mountEditor(element, { document, adapter, onChange }) -> { update, destroy }`. Rendering mode is public, editor, or review. No host credentials appear in generated markup.

- [ ] Write failing automated tests showing that the same hero/text/gallery document produces the same meaningful HTML, node IDs, and asset references in both host adapters; server output includes the text without editor JavaScript.
- [ ] Run the new repository's targeted test script and confirm the parity test fails before implementation.
- [ ] Implement the minimal canonical rendering path, editor mount/unmount contract, style isolation, and disabled preview action handling. Record the selected rendering/editor libraries and dependency cost in an architecture decision.
- [ ] Run the targeted parity and lifecycle tests; require passing SSR content, client enhancement, cleanup, and no editor imports in public entry points. Do not run host builds.
- [ ] Document the resulting interfaces and dependency boundaries before the remaining editor modules are implemented.

### Task 2: Define documents, live bindings, and reversible operations

**Files:** `packages/core/src/document.ts`, `bindings.ts`, `operations.ts`; `packages/core/tests/document.test.mjs`, `bindings.test.mjs`, `operations.test.mjs`.

**Interfaces:** `Node` has stable `id`, `type`, validated properties, children, responsive layout, and style references. Editable values are explicit fixed values or host connection references. `applyOperation(document, operation) -> { document, inverse }`. Host adapters resolve only registered data sources.

- [ ] Write failing tests for mixed fixed/live sections, missing/unpublished references, safe rendering, duplicate-ID rejection, cyclic move rejection, and duplicate operations allocating fresh descendant IDs.
- [ ] Run targeted core tests; confirm the new behaviors are absent before implementation.
- [ ] Implement schema validation/migration, permitted nesting, fixed/live values, and operations for add, move, duplicate, delete, text/style/property updates, and undo/redo. Preserve binding references through presentation changes.
- [ ] Run the core tests, including `undo(move(node)).id === original.id` and a connected text edit that does not call a host record-write action.
- [ ] Record operation grouping rules: one completed text edit/drag is one undo unit; pointer movement is transient.

### Task 3: Deliver the canvas workspace, templates, and elements

**Files:** `packages/editor/src/workspace/`, `packages/editor/src/inspectors/`, `packages/renderer/src/templates.ts`, `docs/DESIGN.md`, `docs/UX-CONTRACT.md`; corresponding component/registry tests.

**Interfaces:** Template/element registries describe permitted nodes, default settings, inspector fields, host capability requirements, and supported bindings. Selection is a node ID, not an array position.

- [ ] Write failing automated tests for template application undo, adding/duplicating/removing nodes, selection persistence, required-capability filtering, and responsive visibility overrides.
- [ ] Run those tests before implementation.
- [ ] Implement a canvas-first workspace with top save/preview/publish/history/device controls, left pages/layers/templates/elements panel, central canvas, and right selected-item inspector. Provide desktop/tablet/phone canvases and zoom-to-fit.
- [ ] Populate whole-page and section presets plus heading, text, image, button/link, container/columns, divider, and gallery elements. Enable commerce/event widgets only when the host advertises their capabilities.
- [ ] Run registry/component tests and document canonical control, loading/error/empty, keyboard, focus, and unsaved-navigation behaviors. Applying a template must preserve host records and be reversible.

### Task 4: Add direct inline text editing and reliable draft saves

**Files:** `packages/editor/src/inline-text/`, `workspace/save-state.ts`; editor inline-text, save-state, and conflict tests.

**Interfaces:** Inline changes issue core operations through the editor command dispatcher. `adapter.saveDraft(document, expectedVersion)` returns an updated revision/version or a typed conflict; local canvas rendering does not wait for the network.

- [ ] Write failing tests for click-to-edit, caret-safe text updates, composition start/end, plain-text paste, bounded marks, escaping, undo/redo, and selection versus link activation in edit mode.
- [ ] Add failing save tests: typing updates the canvas immediately; network saving is debounced; failure retains edits; a stale expected version cannot overwrite the newer draft; final blur flushes the completed edit.
- [ ] Run the targeted tests, then implement inline editing and its contextual toolbar with font/style actions routed through the same command model as the inspector.
- [ ] Mark connected fields distinctly; editing them opens their existing source editor or offers an explicit fixed-copy override. Never silently change live product/event data.
- [ ] Run text and persistence tests. Render saving/saved/offline/conflict/error states and preserve the active publication throughout draft saves.

### Task 5: Add responsive structured dragging

**Files:** `packages/editor/src/layout/`; layout-operation and drag interaction tests.

**Interfaces:** A drop proposal describes node ID, destination container, and before/after sibling ID. The core validates the proposal; valid completed drops dispatch one move operation.

- [ ] Write failing tests for same-container reorder, compatible cross-container drop, invalid/cyclic drop, cancellation, zoom-correct coordinates, and mobile fallback.
- [ ] Add tests requiring Move before/after/into controls and keyboard commands to produce the same document as dragging; keep the source node intact after an invalid drop.
- [ ] Run those tests, then implement insertion markers, container highlighting, flex/grid layout controls, resizing through layout constraints, and non-drag alternatives.
- [ ] Keep pointer updates local and animation-frame scheduled. Assert no persistence call during pointer moves and exactly one grouped operation on a completed drop.
- [ ] Run layout tests and an automated interaction benchmark with the environment and document size recorded. Do not label performance acceptable based on a source review alone.

### Task 6: Add branding, typography, presets, and contrast checks

**Files:** `packages/core/src/theme.ts`, `contrast.ts`, `brand-kit.ts`; `packages/editor/src/inspectors/theme/`; theme/brand/contrast/inspector tests.

**Interfaces:** `validateBrandKit(value)` returns a versioned kit or field errors; `applyBrandKit(document, kit)` returns an undoable draft operation. `checkContrast({ foreground, background, fontSize, fontWeight, role })` returns ratio, required ratio, and pass/fail/needs-review status.

- [ ] Write failing tests for host/JSON import validation, import preview/apply/cancel, token inheritance/reset, unsupported fonts, and one-operation palette undo.
- [ ] Add contrast tests: black/white is 21:1, identical opaque colors are 1:1, 4.499 fails a 4.5 threshold, normal text requires 4.5, qualifying large text requires 3, required control indicators require 3, and an indeterminate photo/video background never receives an automatic pass. Pin large-text boundary cases at 24 CSS px or 56/3 CSS px with weight at least 700; a value just below either applicable boundary uses the normal-text threshold.
- [ ] Run the tests before implementing semantic colors, complete palettes, responsive type scale, font sizes/families/weights/line heights/tracking/alignment, and explicit per-element overrides.
- [ ] Add Clean light, Editorial dark, Forest, Ocean, Warm neutral, and High contrast presets. Validate resolved text/control role pairs for each preset rather than relying on palette labels.
- [ ] Implement contextual contrast feedback, publish-readiness findings, and an accessible-color suggestion the user can apply. Do not silently change colors or imply a complete accessibility certification.
- [ ] Run theme/contrast/inspector tests, including alpha compositing over a known solid background and host-global-brand remaining unchanged after draft import.

### Task 7: Add background and transition controls

**Files:** `packages/core/src/document.ts`, `packages/renderer/src/enhance.ts`, background/motion renderer modules; editor background/motion inspectors and tests.

**Interfaces:** Backgrounds are validated color/gradient/image/video settings with host asset references. Motion uses registered presets and bounded timing/easing settings, not arbitrary scripts.

- [ ] Write failing tests for color/gradient/image settings, focal points, overlays, media authorization/fallback, blocked video playback, offscreen pause, and reduced-motion/data-saving behavior.
- [ ] Add tests ensuring content is visible when client enhancement fails and ordinary public pages do not import editor/free-form or a heavyweight animation engine.
- [ ] Run the targeted tests; implement backgrounds with responsive controls, muted inline optional video, poster fallbacks, and existing progressive media loading.
- [ ] Implement optional entrance/hover/section presets, duration/delay/easing controls, and a page-level motion-disable setting. Default entrance motion to off and respect reduced motion.
- [ ] Run background/motion and public-entry-point tests. Preserve 3D/poster enhancement only for expressly enabled template capabilities.

### Task 8: Add optional bounded free-form sections

**Files:** `packages/freeform/src/`, its renderer integration, optional editor tools, and free-form interaction/responsive tests.

**Interfaces:** Free-form layout belongs to a specific section and breakpoint. Persist bounds, size, alignment constraints, stacking, and semantic child order; maintain a normal-flow fallback.

- [ ] Write failing tests for bounded drag/resize, snapping/alignment guides, layer order, undo, out-of-bounds prevention, and a phone fallback that remains readable without desktop positioning.
- [ ] Run those tests, then implement the optional free-form section and its precise numeric controls. Do not replace normal layout throughout the page.
- [ ] Add automated checks for DOM reading order, zoom, text growth, cancellation, and one persistence operation per completed gesture.
- [ ] Compare drag latency and memory against Task 5 on the same recorded environment/document. Keep the capability disabled until its responsiveness and performance checks pass; a failing gate is a recorded outstanding deliverable, not a silent scope removal.
- [ ] Verify that the free-form package loads only when that capability is used.

### Task 9: Deliver publications and shareable guest review

**Files:** `python/website_builder/models.py`, `services/revisions.py`, `services/reviews.py`, `tests/`; `packages/review/src/` and review component tests.

**Interfaces:** Saved immutable revision + resolved review-data snapshot; independent published revision pointer; review capability scoped to tenant/site/page/snapshot with separate view/comment rights. Thread anchor contains node/field/item identity, normalized point, and viewport.

- [ ] Write failing backend tests for draft/public separation, expected-version conflicts, old-link survival after newer drafts, expiration/revocation, denied cross-tenant access, and withdrawn-media restrictions.
- [ ] Write failing comment tests for guest name entry without an account, untrusted text, scoped replies, resolution permissions, rate/length limits, and immutability of reviewed content.
- [ ] Run those tests; implement snapshot persistence, hashed review secrets, scoped media access, and private/no-store/no-index review responses.
- [ ] Implement numbered pins, element selection, thread/reply/resolution UI, keyboard-accessible thread listing, and explicit reviewed-revision labeling. Keep public event wishes and review comments separate.
- [ ] Run backend/review tests, including node movement preserving identity and a deleted node never reassigning a prior thread to an unrelated element. Preview actions must not perform checkout, booking, RSVP, or public-wish writes.

### Task 10: Integrate PixelCore and Medframe in stages

**Files:** PixelCore's `pixelcore-backend/content/`, `scheduling/`, website editor/public components, and corresponding existing tests; Medframe's `services/api/medframe_apps/websites/`, GraphQL website entry points, `apps/web/features/websites/`, and corresponding tests. Put host adapter implementations in the hosts, keeping the reusable contract in `docs/adapter-contract.md`.

**Interfaces:** Host adapter provides tenant-scoped identity/assets/data, typed domain actions, source-editor navigation, and authorized persistence. The shared editor consumes the same contract for fixed and live sites.

- [ ] Add compatibility tests for existing URLs/revisions/templates, storefront branding/header/footer/global hero/popup, current catalog, actual event schedules, private invitation behavior, and approved Medframe media/queue data.
- [ ] Run targeted tests, then integrate PixelCore storefronts first, event website drafts/publications second, and Medframe's React/GraphQL integration third. Keep compatibility adapters until the shared path reaches feature parity.
- [ ] Preserve Medframe's optimistic version handling and explicit publication review. Do not automatically expose operational team/clinical data through live bindings.
- [ ] Run focused backend/frontend tests and PixelCore `npm run check:ui`; do not build. Prepare reversible content migrations and installation/version-upgrade documentation.
- [ ] Supply an adapter example for DineEase/future projects, explicitly distinguishing an example from an integration verified against their actual code. Validate release ownership before publishing any packages.

## Completion and planning boundaries

The core editor, optional free-form tools, review service, and host migrations can be developed and tested as distinct deliverables in this order. Before executing each subsystem, derive a focused plan from these requirements and the interfaces proven in Task 1. Preserve the full requested scope across those plans; an optional loading boundary is not permission to drop a requested feature.

The original task checklists remain acceptance requirements; unchecked items must not be read as delivered. Current implementation status is recorded below. Package registry and remote repository publishing remain pending a chosen owner/destination.

## Implementation status — 2026-10-23

- [x] Created the separate local `website-builder` Git repository and installable local packages with Vue/React adapters, canonical rendering, and a local no-build runner.
- [x] Added validated document operations, direct text editing, structured drag/reordering, keyboard/button alternatives, templates/elements, responsive inspectors, themes/branding, contrast findings, backgrounds, and opt-in transitions.
- [x] Added immutable drafts/publications, version conflict handling, guest review snapshots and comments, scoped authorization, CSRF, expiration/revocation, and withdrawn-media checks.
- [x] Activated PixelCore page/storefront and event editing/public rendering with actual approved host data; preserved existing URLs and native editor compatibility.
- [x] Prepared React client/server adapters and consumer contracts. The user selected **finish PixelCore first**; Medframe activation is deferred. DineEase is unavailable and unchanged.
- [ ] Finish and measure optional bounded free-form interaction, including resize/snapping and the stated browser performance gate. Its package is experimental and the capability remains disabled.
- [ ] Verify visual quality, native-browser dragging, mobile layouts, and the full accessibility scope when the user requests those checks. Current verification is automated and scoped, with no builds or browser inspections.
- [ ] Publish a remote repository and registry packages after owner/destination selection. Current consumers install local package directories.

This is an initial reusable implementation, not full Wix feature parity. Media selection uses the host library; uploading remains in the host. Existing advanced music/3D layouts retain their native editor until parity is implemented. The finer acceptance checklists above capture remaining depth and must be updated only from direct evidence.
