# Builder priorities 1–4 implementation plan

> For agentic workers: task-based implementation and independent review using the available collaboration tools. The user's explicit implementation request is the execution authorization.

**Goal:** Add safe recovery/history, live data layouts, shared sections and dependable responsive editing.
**Architecture:** Keep the shared validated document/renderer and host adapter boundary. Add focused workspace modules and additive Django APIs/models. Global section publication is independent of website publication.
**Tech stack:** Native DOM editor, Vue/React adapters, JavaScript/TypeScript declarations, Django.
**Spec:** `docs/superpowers/specs/2026-10-24-builder-priorities-1-4.md`.

## Global constraints

- No builds or visual/browser checks. No Docker startup.
- Always Jev/Graphify; keep private records and secrets out of judgments.
- Preserve immutable reviews, tenant authorization, host RSVP and global font families.
- Use canonical editor UI primitives; apply PixelCore check:ui after host frontend changes.

## Review focus

- Recovery scoped across users/tenants, expiry/quota failure and newer server versions.
- Concurrent revision/global edits and publication without leaking pending drafts.
- Missing/invalid public collection fields, unsafe URLs, offsets and empty results.
- Repeated/template/link identities and immutable snapshots after global publication.
- Phone-first edit order, individual reset and inherited heading contrast.

## Tasks

### 1. Persistence and host contract

- [x] Add revision GET/list/read and POST restore; test tenant isolation, stale versions, retained live revision.
- [x] Add GlobalSection and immutable GlobalSectionRevision with independent draft/publication; test create/edit/publish/affected pages, conflicts and frozen snapshots.
- [x] Extend Python document validation for repeater, global-section, scalar field bindings and responsive properties.
- [x] Wire demo and PixelCore public-safe data enrichment, recovery scopes and source catalogs; test actual host integration.

### 2. Recovery/history workspace

- [x] Add local recovery store with seven-day expiry, scope, validation and explicit clearing.
- [x] Add history preview/restore and recovery dialogs using canonical primitives; test restore/export/discard/stale/error handling.
- [x] Integrate save capture/clear without clearing a newer generation; update adapter types.

### 3. Data/repeater workflow

- [x] Add source catalog and typed field picker UI, reusable card creation, protected/detachable bindings and bounded collection controls.
- [x] Add canonical renderer row context, sorting/filtering/pagination, safe URL/asset resolution and empty/error states.
- [x] Test real host collections, repeated bindings, unavailable sources and unsafe input; maintain Vue/React parity.

### 4. Linked sections and responsive controls

- [x] Add linked-section library, create/link/edit/update/publish/detach workflows with affected-page confirmation.
- [x] Render current published sections from safe host data while reviews freeze resolved versions; prevent recursive links.
- [x] Add common effective-style resolver, deterministic breakpoints, per-property reset/visibility, padding/flow/width controls and accurate contrast metrics.
- [x] Run scoped tests, full shared suite, type/syntax/format checks and host UI boundary. Record additive migrations, restart existing standalone runner and document limitations.
