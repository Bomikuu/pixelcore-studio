# Builder priorities 5–8 Implementation Plan

Execution: native, no agents, as explicitly requested by the user.

**Goal:** Finish reusable library management, public metadata, asset tools and additional content elements.
**Architecture:** Shared document validation/rendering; tenant-scoped versioned library endpoints; authenticated media hooks delegate production persistence to the host. Existing UI factory owns editor controls.
**Tech Stack:** JavaScript native DOM, Vue/React adapters, Django, Pillow.
**Spec:** ../specs/2026-10-24-builder-priorities-5-8.md

## Global constraints

No builds, visual tests, browser inspections or agents. Preserve host authorization, global font families and private RSVP contracts.

## Review focus

Cross-tenant library/media access; stale library mutations; invalid/oversize image uploads; malicious imported URLs/settings; tabs keyboard focus and readable fallback; private invitation indexing policy.

## Tasks

- [x] Library: add model fields and immutable template revisions in models/migrations; tenant-scoped list/detail/version/restore in services/library.py and views/urls; adapter and workspace/library-manager.js; tests cover stale writes, isolation, archive/delete/restore and long-title import.
- [x] Page settings: core/page-settings.js validation/metadata/findings; document/template/operation and Python validation parity; workspace/page-settings.js; renderer head and PixelCore public consumers; tests cover dangerous URLs, review noindex, metadata escaping and host policy.
- [x] Media: core/media.js reference analysis/remapping; services/media.py validates and makes renditions; hooks persist/list approved assets in standalone and PixelCore; adapter upload transport and workspace/media-panel.js; image inspector and renderer fit/focal/renditions; tests cover unauthorized uploads, invalid files, missing assets and imported replacement.
- [x] Elements: core/content.js validation and Python parity for accordion/tabs/video; renderer/enhance and library presets; inspector editing; tests cover safe escaping, keyboard navigation, no-JS content and schema limits.
- [x] Verify: targeted tests then shared automated suite, typecheck/check/format; PixelCore bridge tests and check:ui if changed; migration consistency; maintain adapter/design/audit/verification docs. No build or browser check.
