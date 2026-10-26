# Component Lab implementation plan

**Goal:** A branded standalone admin importer with isolated previews and an optional approved component catalog.
**Architecture:** Root-level Studio UI/Django app, separate preview origin, immutable uploaded revisions, small optional catalog/runtime package. Installed packages never import the Studio app.
**Spec:** docs/superpowers/specs/2026-10-24-component-lab.md; user approved the proposal and administrator-only recommendation on 24 October 2026.
**Execution:** Native, no agents. Automated tests only, no builds or browser/visual/manual checks.

- [x] Add standalone admin access/session/enrollment, component/version storage, bounded archive/JSON validation, immutable versions, approval/rollback/export and isolated runtime routes. Verify auth, CSRF, archive paths/bounds and version boundaries.
- [x] Add optional catalog/runtime contract and safe component references, public fallback rendering and explicit editor catalog insertion. Verify opt-in, message validation, lifecycle/fallback and no private-data discovery.
- [x] Create branded library/import/preview/configuration page with responsive layouts, canonical controls, retry/focus/loading/empty states, device/theme/motion previews and sample download.
- [x] Integrate standalone routes/navigation/preview process, update contracts/docs and run targeted/full automated checks. Restart local development services after successful checks.

## Review focus

Auth on every management route; first-admin setup only on local debug with one atomic enrollment; immutable drafts and approved catalog isolation; archive traversal/symlink/expansion bounds; HTML sandbox headers even on direct navigation; preview token expiry; no authenticated-origin access or server-side package execution; source/window-bound messages and declared public inputs only; teardown and fallback; import state retention; host package exclusion.
