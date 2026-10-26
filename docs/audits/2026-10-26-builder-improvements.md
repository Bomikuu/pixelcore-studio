# Website builder audit — 26 October 2026

## Follow-up implementation

Findings 1–4 were implemented after this audit: explicit branding retention; consistent content modes with server publication guards; scrollable full-page device previews; and empty-media readiness warnings with element-selection recovery. The audit evidence below is the original pre-fix record. Findings 5–8 and the larger feature roadmap remain follow-up work.

## Scope and evidence

Reviewed the shared editor, six premade templates, public renderer, context setup, media/publication checks, dashboard search and account settings. PixelCore’s host bridge was read to check event/home destinations. No application code was changed during this audit.

Evidence consists of source inspection, the current 202-test frontend suite, targeted Happy DOM reproductions, the Premium strict static audit and a scoped Impeccable source detector. Jev recommended repairing the reproduced template-flow gaps before adding more packs; this is advisory, not independent validation. Graphify’s existing 412-node map was queried, then current source was read because the graph predates the latest premade module.

No builds, browser visual inspections, screenshots, manual verification, network timing measurements or backend authorization audit ran. These findings do not establish visual polish, measured page speed or complete accessibility compliance.

## Implementation integrity verdict

The product has a coherent foundation: one renderer, canonical editor controls, separate draft/publication flows, inert review previews, host-owned operations and global typography. However, two setup choices do not match their resulting documents: keeping branding changes the palette, and choosing fixed content can leave live collections in place. Repair these before treating the template setup flow as finished.

## Provisional source-audit score

These are evidence-limited engineering scores, not browser or usability scores.

| Dimension                | Score     | Main evidence                                                                                                                                  |
| ------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility            | 3/4       | Named controls, semantics and automated tests; large previews excluded from keyboard focus, settings errors lack field associations.           |
| Performance              | 3/4       | Lazy media, bounded libraries and keyed canvas updates; leading content images are also lazy, without priority selection. No timings measured. |
| Responsive design        | 2/4       | Phone/tablet rules exist, but template detail previews inherit a narrow column rather than an actual desktop viewport.                         |
| Theming                  | 2/4       | Shared light/dark tokens and global font policy; setup’s keep-brand choice fails to preserve colors.                                           |
| Implementation integrity | 2/4       | Shared architecture is sound; content-mode and readiness gaps create misleading outcomes.                                                      |
| **Total**                | **12/20** | **Significant workflow improvements remain despite passing regression tests.**                                                                 |

Verified issues: **0 P0, 2 P1, 6 P2, 0 P3**. Performance consequences and browser layout consequences below are identified as inferences where they have not been measured.

## Findings in implementation order

### 1. [P1] Keeping branding changes the page’s colors

- **Category:** Theming / implementation integrity.
- **Location:** [context.js](/home/micxsz/projects/website-builder/packages/editor/src/workspace/context.js:114), template application at line 149 and font restoration at line 162.
- **Reproduction:** Start with primary color `#a10052`, select Landing minimal, leave “Keep this page’s colors and fonts” selected, complete setup. The resulting primary is `#125b50`. The complete colors object differs from the original.
- **Impact:** A clear user choice unexpectedly changes business branding. Undo remains available, but users should not need it to recover a setting they chose to retain.
- **Recommendation:** Explicitly offer Keep current branding, Use template colors and Import business branding. Preserve the selected source’s colors and the global two-font policy. Explain unavailable brand imports and retain one-step undo.
- **Acceptance:** Automated cases cover all branding choices, missing brand kits, host frames and Undo.
- **Suggested command:** `/impeccable harden`.

### 2. [P1] Fixed-content setup can create a live-data page

- **Category:** Implementation integrity / clarity.
- **Location:** [context.js](/home/micxsz/projects/website-builder/packages/editor/src/workspace/context.js:70), mode assignment at line 152; [render.js](/home/micxsz/projects/website-builder/packages/renderer/src/render.js:74).
- **Reproduction:** Start with a fixed document, choose a storefront template, finish setup. The document reports `mode: fixed`, but rendering later product data displays the later product.
- **Impact:** The content selector does not reliably describe what will change when system records change. This matters directly to the promised live-versus-static distinction.
- **Recommendation:** Define and enforce the mode contract at setup and template application. Live templates should advertise and retain their required connections. Fixed mode must either disallow live sections with a useful explanation or use an explicit, reviewed conversion of approved public content. Do not silently freeze operational/private records. Define shared branding/header behavior separately from page-body mode.
- **Acceptance:** Fixed/live choices produce matching behavior after source changes; incompatible templates cannot silently produce a contradictory mode; mode conversion preserves identity, fonts, undo and host boundaries.
- **Suggested command:** `/impeccable clarify` followed by `/impeccable harden`.

### 3. [P2] Template detail preview cannot provide a proper full-page inspection

- **Category:** Accessibility / responsive design.
- **Location:** [dialog.js](/home/micxsz/projects/website-builder/packages/editor/src/library/dialog.js:232), [styles.js](/home/micxsz/projects/website-builder/packages/editor/src/workspace/styles.js:12).
- **Evidence:** The detail iframe inherits `.library-preview { pointer-events: none }`, has `tabindex=-1`, and contains another blanket pointer-events rule. Its height is 380px and its width is 100% of a narrow detail column. Phone mode changes the container’s maximum width to 300px.
- **Impact:** The owner cannot readily inspect the complete body/footer with pointer or keyboard before applying a template. “Desktop preview” is rendered at the detail column’s width, so it can use mobile breakpoints instead of representing desktop. The CSS consequence is source-derived; no browser geometry measurement was performed.
- **Recommendation:** Keep card thumbnails inert. Provide a separate scrollable large preview with real desktop/tablet/phone rendering widths, scaled outside the rendered viewport as needed. Make preview scrolling keyboard accessible. Keep forms, guest submissions and external navigation safely inert. Include section jumps and a clear return to the library.
- **Acceptance:** The footer is reachable by pointer and keyboard; each device choice changes the iframe’s actual layout viewport; preview cannot submit RSVP or mutate records.
- **Suggested command:** `/impeccable adapt`.

### 4. [P2] Empty image slots are missing from publication readiness

- **Category:** Implementation integrity / content completeness.
- **Location:** [media.js](/home/micxsz/projects/website-builder/packages/core/src/media.js:9), [publication.js](/home/micxsz/projects/website-builder/packages/core/src/publication.js:11).
- **Reproduction:** Create a landing template without assets. It contains two image nodes with empty asset IDs, but publication findings contain zero media findings. Existing alt-text warnings are separate and do not identify the unfilled media slot.
- **Impact:** Layouts can lose their key photographs while the media checklist reports no missing references. On an empty host, the resulting page may feel unfinished even though the template is structurally complete.
- **Recommendation:** Distinguish an intentionally text-only layout from an unfilled image slot. Offer Choose image, Replace with a text-only section and Remove slot. Add a clear warning for unfilled slots; reserve blocking behavior for media marked required. Add a hero/story/gallery media-mapping step before applying an image-led template.
- **Acceptance:** Empty IDs, unavailable bound images, missing referenced assets and intentionally omitted media have separate actionable results.
- **Suggested command:** `/impeccable onboard` and `/impeccable harden`.

### 5. [P2] Wedding wordmark can send visitors to the business storefront

- **Category:** Implementation integrity / navigation.
- **Location:** [widgets.js](/home/micxsz/projects/website-builder/packages/renderer/src/widgets.js:78); PixelCore supplies the business home URL in [builder_bridge.py](/home/micxsz/projects/pixelcore-platform/pixelcore-backend/content/builder_bridge.py:91).
- **Reproduction:** Render an event with an event title and `identity.homeUrl: /site/sample`. Its wedding wordmark displays the event title but links to `/site/sample`.
- **Impact:** Clicking the invitation’s identity takes the guest out of the event rather than to its opening section.
- **Recommendation:** Resolve the wordmark destination from page context. Use the event public URL or an explicit invitation-top anchor for events; retain the business home for storefronts. Keep review navigation inert.
- **Acceptance:** Storefront, landing, event and review header destinations have separate coverage.
- **Suggested command:** `/impeccable harden`.

### 6. [P2] Leading content photographs use the same loading policy as below-fold media

- **Category:** Performance.
- **Location:** [render.js](/home/micxsz/projects/website-builder/packages/renderer/src/render.js:108).
- **Evidence:** The first main image in Storefront editorial renders with `loading=lazy` and no fetch priority. The generic image helper applies lazy loading to all content images.
- **Impact:** A likely above-fold/LCP image receives no intentional loading priority. A delay is a performance risk, not a measured result from this audit.
- **Recommendation:** Select a single visible leading image for eager/appropriate priority loading, retain lazy loading below the fold, and preserve intrinsic dimensions and renditions. Treat background-image heroes separately. Avoid marking every image high priority.
- **Acceptance:** One leading image receives the intended policy; gallery/product media stays lazy. Measure actual page behavior in a separately authorized browser performance pass.
- **Suggested command:** `/impeccable optimize`.

### 7. [P2] Search lacks a consistent clear action and composition handling

- **Category:** Accessibility / interaction consistency.
- **Location:** [dialog.js](/home/micxsz/projects/website-builder/packages/editor/src/library/dialog.js:138), [dashboard.js](/home/micxsz/projects/website-builder/studio/web/dashboard.js:144), media and layer searches.
- **Evidence:** Library search is a text input without an authored clear button. Dashboard search is a native search input, whose built-in clear UI is browser-dependent. Their input handlers do not guard composition events; remote work uses a debounce but can still begin during composition. A DOM probe found zero library clear-search buttons.
- **Impact:** Owners must erase filters manually in some workspaces; input methods may trigger intermediate result requests. Search behavior differs across the product.
- **Recommendation:** One canonical Search field with a named Clear button, immediate reset, focus return, composition-safe updates, explicit Enter behavior and existing stale-response protection.
- **Acceptance:** Keyboard clear, composition, Enter, immediate reset and stale responses are covered in each consuming workflow.
- **Suggested command:** `/impeccable harden`.

### 8. [P2] Account validation feedback is not associated with the relevant field

- **Category:** Accessibility / error recovery.
- **Location:** [settings.js](/home/micxsz/projects/website-builder/studio/web/settings.js:12), shared [field primitive](/home/micxsz/projects/website-builder/packages/editor/src/components/ui/index.js:60).
- **Evidence:** Failed requests reach a single page-level status/alert. Settings does not set `aria-invalid`, associate field help/error messages or focus the first invalid control. A page-level server/network error is appropriate; correctable field errors need another path.
- **Impact:** The person sees an error away from the input and must identify the field themselves. Assistive technology has no field-level error association.
- **Recommendation:** Preserve a structured server-field error response, add the behavior to the canonical form/field owner, keep global feedback for non-field failures and focus the first invalid field after failed submission. Preserve entered values.
- **Acceptance:** Invalid profile/email/password responses have connected text errors and focus; network errors retain retry without falsely marking fields invalid.
- **Suggested command:** `/impeccable harden`.

## Recommended feature additions after the fixes

| Order | Feature                                               | Scope and benefit                                                                                                                                                                                                                           |
| ----- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Context brief and media mapping                       | Ask purpose, visitor action, relevant source, preferred content and hero/gallery choices. Prefill approved business/event information and show which sections will be live. Keep this short and resumable.                                  |
| 2     | Site identity and footer manager                      | A spacious modal for logo, public contact details, social profiles and navigation. Save through the authorized host branding/source adapter; show inherited/locked fields instead of creating a competing source of truth.                  |
| 3     | Change a section’s layout while retaining its content | Switch split/image-led heroes, two/three-column content and footer variants without rebuilding the entire page or discarding bindings. Show a preview and preserve Undo and responsive overrides.                                           |
| 4     | More purpose-specific template packs                  | Add service business and portfolio packs first; add restaurant/conference/public clinic packs when their public host data contracts are ready. Each pack needs genuinely different structure and truthful defaults, not only a new palette. |
| 5     | Responsive navigation presets                         | Offer compact, centered and collapsible mobile headers with named menu controls, correct expanded state, keyboard/Escape behavior and real configured destinations. Preserve native complex host menus.                                     |
| 6     | Host-backed inquiry forms                             | Useful for landing pages once a host accepts submissions, handles validation/spam controls and exposes status. Do not insert a decorative form that cannot send or imply RSVP/booking permissions it does not have.                         |

An integrated analytics report is a later feature requiring a real provider/API integration. The current setup guide is intentional; do not invent visitor metrics. Review comments, history, recovery, shared sections and global font pairs already exist and should be strengthened rather than re-added.

## Suggested delivery batches

1. **Correctness:** findings 1–2 — branding and fixed/live semantics.
2. **Template completion:** findings 3–5 — proper full previews, empty-media decisions and event navigation.
3. **Shared interaction quality:** findings 6–8 — image loading, search and field validation.
4. **New capability:** context/media mapping, host-backed footer manager, then content-preserving section variants and new packs.

Command order: `/impeccable clarify` → `/impeccable harden` → `/impeccable adapt` → `/impeccable onboard` → `/impeccable optimize` → `/impeccable polish`. Re-run `/impeccable audit` after fixes. These are proposed follow-up passes, not changes performed by this audit.

## What is working and should remain

- 202 current frontend tests pass, including template structure, JSON portability, host frame ownership, global fonts, Undo, live-data updates, inert reviews and named controls.
- The Premium strict contract audit reports zero findings. The scoped Impeccable detector returns `[]`; it does not detect the reproduced behavioral gaps above.
- Real host records and approved media remain separate from authored page structure. Guest operations remain owned by the host.
- One header/footer policy and shared public renderer are in place.
- Drafts, publication, immutable reviews, history, recovery, safe links, responsive rules and light/dark editor appearance already have meaningful coverage.
- No product code, data or publication was changed during this audit. No build or visual acceptance result is implied.
