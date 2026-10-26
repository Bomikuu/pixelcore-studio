# Studio audit improvements implementation plan

**Goal:** Complete the six recommended workflows and nine audited reliability gaps, using the approved 25 October audit as the brief.

**Architecture:** Extend existing native editor/renderer and Django services; keep host authorization and public-data contracts authoritative. Use shared UI controls and existing branding. No new frontend framework, agent, build, visual inspection, or operational-data copy.

**Spec:** ../../2026-10-25-studio-builder-audit.md. User explicitly requested implementation and native execution without agents.

## Tasks

- [x] Discovery: shared authorized pagination/search/filter/sort; Studio dashboard and source chooser use bounded server pages; preserve totals and query state. Test more than 100 records, pending updates and tenant exclusion.
- [x] Reliability: keyboard review anchor ownership, visible account failures, short-height/touch rules, available font registry and host font CSS. Test nested activation, failure retry and font choices.
- [x] Review center: authenticated paginated list, expiry/comment controls, revocation and owner threads; native management UI, saved viewport and jump-to-element. Test guest exclusion, stale revisions, expiry, revalidation and teardown.
- [x] Publication: aggregate content/media/binding/link/contrast checks with existing draft/live comparison and global impact. Offer element navigation and preserve retry. Test warnings, blockers and host-owned publication.
- [x] Context/data: compatible template packs with requirement details and fallback explanations; connected-data refresh/status and bound-field diagnostics. Test no private data discovery, latest result ownership, errors and widget constraints.
- [x] Performance: keyed canvas patching without iframe rewrites on edits; summary-only paginated design lists and selected-content fetch. Test preserved element/media identity, mode changes, library pagination and teardown.
- [x] Analytics: explicit per-business visitor choice and revocation in PixelCore via canonical Shadcn controls; connect consent to public renderer and expose accurate setup states. Test no script before consent, withdrawal and business scoping. Reports remain in actual providers.
- [x] Verify and document: scoped/full automated suites, typecheck, source checks, PixelCore check:ui, bounded Impeccable/Premium checks; restart standalone server if needed. No publishing, registry release or Medframe activation.

## Review focus

- Authorization is rechecked for every host proxy and owner review operation.
- Search/pagination and dynamic refresh retain latest intent after errors or teardown.
- Immutable review data never receives guest invitation identity or operational actions.
- Performance changes preserve IME, selected DOM, caret and public renderer behavior.
- Consent defaults to off and survives only within its business scope; revocation cleans up tracking.

Evidence and practical limits are recorded in ../../verification.md under Studio audit implementation. All tasks were executed in this chat without agents.
