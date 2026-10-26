# Studio Dashboard and Identity Implementation Plan

> **For agentic workers:** Implement natively in this session, task by task, without subagents or delegated reviewers, as explicitly requested by the user. Preserve that execution method throughout this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retain Studio login across a responsive dashboard, builder and Component Lab; reuse verified PixelCore business identity; provide avatar/settings management and a truthful analytics setup workflow.

**Architecture:** Studio owns its cookie session and local account profile. PixelCore owns platform identity, business membership, websites and publication. A one-use authenticated handoff establishes a business-scoped, server-held connection; an allowlisted transport reuses existing host builder operations without copying host documents into the Studio database.

**Tech Stack:** Existing native JavaScript/shadow DOM, canonical editor controls/tokens, Django, PixelCore Django REST Framework and Nuxt/Pinia; existing Pillow image tooling. No new identity service, Docker service or UI framework.

**Spec:** `docs/superpowers/specs/2026-10-24-studio-dashboard-and-identity.md` (approved 24 October 2026).

## Global Constraints

- A user already authenticated to an integrated platform enters that platform's business workspace without another password prompt.
- Host websites, records and authorization remain in the host.
- A verified platform user is not automatically a Studio administrator.
- No access/refresh token in a URL or client persistent storage.
- Public renderers remain independent of Studio/editor/review runtime code.
- No builds, visual tests, browser inspections or manual verification unless the user explicitly requests them.
- Preserve Pixelcore's supplied icon, small live-text wordmark, Manrope, existing shared tokens, default light mode and optional dark mode.
- Use Jev with secret-free inputs and Graphify to trace code relationships; verify both directly.
- Keep all existing credentials/data; use additive migrations. Do not commit the currently untracked repositories wholesale or modify protected DineEase source.

## Review Focus

1. Simultaneous localhost applications: Studio cookie changes must not break PixelCore authentication or installed transports. Pinned in Task 1.
2. Expired, replayed or foreign login messages and membership removed after connection: reject access without falling back to sample data. Pinned in Tasks 2 and 3.
3. Explicit sign-out versus automatic sign-in: logout must not immediately reconnect the same platform; unfinished edits must remain recoverable. Pinned in Tasks 3 and 4.
4. Malformed/oversized avatar images and platform-owned identities: reject unsafe uploads and prevent a local profile copy from overriding the host identity. Pinned in Task 5.
5. Analytics config saved without publication, consent or real verification: distinguish every state and avoid tracking Studio/review traffic. Pinned in Tasks 6 and 7.

## File and interface ownership

Paths below are relative to `/home/micxsz/projects/website-builder`, except those prefixed `PixelCore`, which are relative to `/home/micxsz/projects/pixelcore-platform`.

- `studio/server/component_lab/identity.py`, `workspace.py`, `platforms.py`, `profiles.py`: focused server services; existing `views.py` retains component import/version/approval behavior.
- `studio/web/session.js`, `shell.js`, `dashboard.js`, `settings.js`, `analytics.js`, `builder.js`: standalone account and workspace UI, outside installed packages.
- `packages/core/src/analytics.js` and `python/website_builder/analytics.py`: shared structured analytics validation; no account UI or provider secrets.
- `PixelCore pixelcore-backend/content/studio_bridge.py`: trusted host handoff and business-scoped gateway; host authorization stays in the host.
- `PixelCore pixelcore-frontend/pages/studio-connect.vue`: narrowly trusted host-side connection page using the existing auth store.

## Task 1: Shared Studio identity and cookie isolation

**Files:** Modify `studio/server/component_lab/{settings.py,views.py,urls.py}`, `packages/core/src/{http.js,index.d.ts}`, `packages/editor/src/index.d.ts`, `studio/web/lab.js`; create `studio/server/component_lab/identity.py`, `studio/web/session.js`, `studio/server/component_lab/test_identity.py`, `tests/studio-session.test.mjs`; update `studio/server/run_tests.py` to discover the new test modules.

**Interfaces:** `session_payload(request)` returns `{authenticated,user:{id,username,displayName,email,avatarUrl,source,settingsUrl},workspace,capabilities:{editWebsite,manageComponents},csrfCookieName,platforms,silentConnectAllowed}`. Existing `username` and `canEnroll` response fields remain during migration. `createStudioClient({fetcher,document})` exposes `session()`, `send(path,options)`, `signOut()` and uses `studio_csrftoken`. `createJsonClient` gains optional `csrfCookieName`, defaulting to `csrftoken` for installed hosts.

- [x] Add regression Django tests for anonymous versus active nonstaff versus staff identity, session retained after repeated GETs, CSRF-enforced login/logout and distinct `studio_sessionid`/`studio_csrftoken` cookies. Assert component management still denies nonstaff users.
- [x] Add regression Node tests proving an explicit Studio CSRF cookie is used for JSON and multipart writes, while the default installed client still uses `csrftoken`; include conflicting host cookie values.
- [ ] Run `npm run test:studio` and `node --test tests/studio-session.test.mjs`; confirm failures correspond to the new contract.
- [x] Extract shared session identity from `views.py`; retain existing first-owner enrollment and password validation. Use a seven-day server-backed session, HttpOnly session cookie, SameSite=Lax, and Secure outside local development. Set `Cache-Control: no-store` on identity responses.
- [x] Implement the common frontend transport and optional core CSRF configuration. Authenticate active users independently of staff capability; preserve explicit component-admin authorization and generic sign-in errors.
- [x] Run the targeted tests, `npm run typecheck` and existing Component Lab tests. Review the scoped diff; do not create an unrelated baseline commit.

## Task 2: PixelCore one-use identity handoff and business gateway

**Files:** Create `PixelCore pixelcore-backend/content/{studio_bridge.py,test_studio_bridge.py}`; modify `content/{models.py,urls.py,builder_bridge.py}` and `pixelcore_backend/settings.py`; create the next available content migration for `StudioHandoff` and `StudioGrant`. Create `studio/server/component_lab/{platforms.py,test_platforms.py}`; extend local models/URLs/settings with an additive migration for `PlatformIdentity` and `PlatformConnection`.

**Interfaces:** Studio `POST /api/studio/connect/begin/` accepts configured `platformId`, returns `{state,frameUrl,expiresAt}` and binds state to the initiating session for 60 seconds. Host JWT-authenticated `POST /api/businesses/<uuid>/studio/handoffs/` accepts `{state,audience}` and returns `{code,state}`. Studio `POST /api/studio/connect/complete/` accepts `{platformId,code,state}`, consumes the local state and performs a server exchange. Host `POST /api/studio-bridge/exchange/` returns `{subject,business,user,grant,expiresAt,capabilities}` only to its configured confidential Studio client. Host `POST /api/studio-bridge/gateway/` accepts a server-held restricted grant plus `{operation,websiteId,args}`, never an arbitrary target URL. Logout revokes the current grant through a dedicated authenticated revoke operation.

- [x] Write regression host tests for 60-second expiry, atomic one-use code consumption, invalid audience/state/client authentication, inactive user, nonmanager membership, revoked grant and cross-business website IDs. Add a concurrent-consumption case on the supported transaction path.
- [x] Write regression Studio tests for session-state mismatch, unknown platform, issuer/subject mapping, no email-based merging, blocked arbitrary upstream URLs and a platform user receiving no component-admin rights.
- [ ] Run host `venv/bin/python manage.py test content.test_studio_bridge` and shared `npm run test:studio`; confirm expected failures.
- [x] Store code/grant digests on the host, never plaintext. Exchange under a transaction; codes expire after 60 seconds. Grants expire after seven days, support explicit revocation and recheck active user/business membership on every operation. Authenticate server exchange/gateway calls using configured client credentials sent only over trusted HTTPS endpoints (explicit loopback HTTP allowed in local development).
- [x] Store the opaque host grant only in the Studio server database, bound to the initiating authenticated session, stable issuer/subject and selected business. Never mark mapped users staff. Never expose a grant or platform JWT in a browser response, logs or recovery storage.
- [x] Implement named gateway operations covering workspace overview, existing source bootstrap, all existing editor adapter operations, media upload and analytics settings. Resolve existing shared views through an explicit dispatch map, preserving their tenant/permission/version checks; do not forward browser authorization/cookie/Host headers or accept caller-selected URLs. Cap payloads, enforce request timeouts, disable redirects and validate uploaded-media limits.
- [x] Persist integration configuration for explicit platform IDs, fixed API/frontend origins, client ID/secret source and permitted callback origin. Missing configuration yields an unavailable connection state; never derive trust from a query string or blindly copy Django secret keys.
- [x] Run new host/shared tests and existing `content.test_builder_bridge`; run migration drift checks in both apps. Document exact environment configuration without writing secrets into tracked files.

## Task 3: Automatic platform connection and authorized workspace transport

**Files:** Create `PixelCore pixelcore-frontend/pages/studio-connect.vue`, `studio/web/platform-connect.js`, `studio/server/component_lab/workspace.py`, `studio/server/component_lab/test_workspace.py`; modify Studio URLs, `scripts/dev.mjs`, `python/website_builder/{demo_urls.py,demo_hooks.py}` under an explicit Studio-only authorization setting, and `tests/dev-http.test.mjs`; add `tests/studio-connect.test.mjs`.

**Interfaces:** `connectPlatform({root,client,signal,onConnected,onChoices})` loads only server-configured host pages and returns a disposer. Messages use a versioned `studio:connect` envelope and require exact `event.origin`, `event.source`, nonce/state and schema validation. Studio `GET /api/studio/workspace/` returns `{identity,workspace,sites,capabilities}`; `POST /api/studio/workspace/open/` accepts a host source or authorized website ID and returns the existing builder bootstrap shape plus its Studio transport base. `/api/studio/workspace/builder/…` accepts only an enumerated method/route map matching `createDjangoAdapter`, translated to Task 2 operations.

- [x] Add regression DOM tests for wrong message origin/source/state, signed-out and unavailable hosts, multiple eligible businesses, cancelled/stale connections and silent-connect suppression after explicit logout.
- [x] Add regression server tests for anonymous demo/bootstrap access under Studio settings, unauthorized business/source selection, host rejection without sample fallback, and all adapter operation groups including multipart upload, shared sections, templates, history, review and publication.
- [ ] Run the targeted tests and host bridge tests; confirm expected failures.
- [x] Implement the host connection page using `useAuthStore().restoreSession()` and `useApiClient()` without exporting host access/refresh tokens. Require an exact configured Studio parent origin, reply only to the initiating parent, and expose only businesses the existing host permits the user to edit. One eligible business can connect automatically; multiple businesses require an accessible choice in Studio. No repeated iframe/login loops.
- [x] Implement server workspace routing: authenticated local staff may open explicitly labeled local-demo data; platform users use their host connection. Preserve host website/source IDs and recovery scopes. Protect local demo editing endpoints through Studio-specific hooks without breaking independent shared-package demo tests or public demo publication/review routes.
- [x] Reuse the installed editor adapter against the restricted Studio route map. Handle grant expiry/revocation with a reconnect error code; preserve in-memory and existing scoped recovery data rather than loading demo records. On explicit logout clear that identity's recovery copies and suppress silent reconnection until the user chooses Connect.
- [x] Extend automated HTTP tests to cover a two-origin host/Studio connection fixture and session restoration. Run `npm run check:ui` in PixelCore frontend and the targeted tests.

## Task 4: Studio shell, dashboard and builder integration

**Files:** Create `studio/web/{shell.js,dashboard.js,builder.js,styles-shell.js}`, `tests/studio-shell.test.mjs`; modify `studio/web/{app.js,index.html,lab.js}`, `examples/{app.js,index.html}`, `scripts/dev.mjs`, `DESIGN.md`, `UX-CONTRACT.md`, `.impeccable/surfaces/studio-dashboard.md`.

**Interfaces:** `mountStudio(host,{fetcher})` owns identity resolution, route dispatch and disposal. `mountShell(host,{session,workspace,onSignOut})` provides a content region and `destroy()`. `mountDashboard(region,{client,workspace})` and `mountBuilder(region,{client,setup})` return disposers. Component Lab receives the common client/session and a standalone-content mode; its existing direct mount remains compatible with tests.

- [x] Add regression DOM tests for protected-route login/return, retained identity across dashboard/builder/Lab, avatar menu/settings navigation, role-sensitive Lab visibility, keyboard-operable custom tooltips, appearance persistence and complete disposer cleanup. Add an unsaved-edit navigation/sign-out test using the editor's existing guard.
- [ ] Run `node --test tests/studio-shell.test.mjs tests/component-lab.test.mjs`; confirm expected failures.
- [x] Route `/` to `/studio`, move editing to `/studio/builder`, and serve the shared app for `/login`, `/studio`, `/studio/analytics` and `/studio/settings`. Keep public review/publication routes separate. Validate internal return paths to prevent open redirects.
- [x] Implement the reference layout using existing tokens/primitives: compact brand header, icon rail with custom tooltips, contextual navigation, main content and an avatar menu. Collapse navigation below 800px; stack overview content below 650px. Keep all routes reachable by keyboard and avoid controls for unimplemented analytics/testing features.
- [x] Build overview sections from real workspace records: website/source selector, publication state, last edit, page count, existing revision activity and Open builder. Render analytics setup status and useful empty/error/reconnect states, with no fabricated metrics.
- [x] Integrate the editor and Component Lab without duplicated headers or session forms. Preserve focus, uploads, save/recovery behavior and existing editor exit callbacks. Reserve space for real/fallback avatars and hide privileged actions according to capability while retaining server checks.
- [x] Run targeted shell/Lab/editor/accessibility tests and static syntax checks. Update DESIGN and UX-CONTRACT with route/auth/navigation ownership; use no browser or visual verification.

## Task 5: Local profile, safe avatar and account settings

**Files:** Create `studio/server/component_lab/{profiles.py,test_profiles.py}`, `studio/web/settings.js`, `tests/studio-settings.test.mjs`; extend Studio models/URLs with an additive `StudioProfile` migration and shared user-menu rendering in `shell.js`/`lab.js`.

**Interfaces:** authenticated `GET/PATCH /api/studio/profile/` handles local `{displayName,email}`; multipart `POST /api/studio/profile/avatar/` replaces the caller's avatar; `DELETE` removes it. `POST /api/studio/profile/password/` accepts `{currentPassword,newPassword}` and updates the current session auth hash on success. Platform identity responses expose the authoritative host `settingsUrl`; local writes to mapped identity fields are denied. `avatarNode(document,user)` supplies a fixed-size image with initials fallback.

- [x] Write regression Django tests for own-account-only profile changes, email validation, platform-field rejection, current-password verification and preserved current session after a password change. Upload cases: valid JPEG/PNG/WebP, forged MIME, SVG, animated image, >2 MB, decompression bomb and malformed bytes.
- [x] Write regression DOM tests for avatar image errors, input retention on failed saves, duplicate-submit prevention, password reveal/autocomplete semantics, dirty navigation guard and platform settings links.
- [ ] Run the targeted Studio server and Node tests; confirm expected failures.
- [x] Implement image decoding with Pillow: maximum 4096×4096 source dimensions, reject animations/decompression warnings, re-encode a 256×256 WebP rendition with metadata stripped. Serve generated avatar keys through a narrowly scoped image endpoint with explicit MIME/nosniff; replacement and removal clean up the prior owned rendition after a successful database update.
- [x] Implement the settings page with profile, appearance and security sections. Use the canonical fields/buttons, inline errors, save feedback and explicit avatar replacement/removal. Keep username stable. Platform profiles link to the verified host account route instead of creating conflicting local identity fields.
- [x] Run the targeted tests and migration drift check; verify avatar/name updates propagate through the common session state without stale header UI.

## Task 6: Structured analytics configuration and publication boundary

**Files:** Create `packages/core/src/analytics.js`, `python/website_builder/analytics.py`, `tests/analytics.test.mjs`, `python/website_builder/tests/test_analytics.py`; modify shared document creation/types/validation and revision publication handling only where needed. Extend Task 2 host gateway and Task 3 workspace service with analytics configuration operations; add owning-host tests.

**Interfaces:** optional document-level `analytics` contains `{provider:'none'|'google'|'plausible',domain,measurementId?,scriptUrl?}`. `validateAnalytics(config)` has matching JS/Python rules. Setup progress is workspace metadata keyed by website and configuration fingerprint, separate from public document data. `GET/PUT /api/studio/workspace/analytics/<websiteId>/` returns `{draft,published,status,verification,consentAvailable}`; user-confirmed verification includes revision/config fingerprint and timestamp, never a fabricated provider result.

- [x] Write regression parity tests for malformed domains, credentials/ports/query strings, unsupported providers, executable strings, invalid Google IDs and untrusted Plausible script URLs. Test publication copies only validated configuration, config changes invalidate prior verification, and an entered ID alone never marks traffic as verified.
- [ ] Run `node --test tests/analytics.test.mjs` and the targeted shared Django tests; confirm expected failures.
- [x] Define structured provider validation and a bounded Google tag ID format consistent with the official guide. For Plausible accept only explicitly trusted provider HTTPS script origins and the provider's site-specific script path; reject arbitrary pasted HTML and URL redirects. Defaults remain `provider:'none'` for existing documents.
- [x] Persist draft settings through the owning website's existing revision/conflict mechanism, publish only through the existing explicit publish action, and retain checklist verification separately. Check host ownership on read, write and confirmation; no reporting API secret enters documents or browser responses.
- [x] Add a small optional public analytics enhancer shared by native/React/Vue public renderers. It accepts only validated published config and a host-provided consent decision, deduplicates script installation and cleans up route listeners. Default to no tracking when required consent integration is absent; expose that missing setup state honestly. Never activate it inside the editor, review, SSR preview or Component Lab.
- [x] Run parity, renderer, SSR and host publication tests, including disabled-consent, unpublished-config and review/editor isolation cases. Recheck public entry dependency boundaries.

## Task 7: Analytics guide and final integration verification

**Files:** Create `studio/web/analytics.js`, `tests/studio-analytics.test.mjs`, `docs/studio-accounts.md`; update `README.md`, `docs/{adapter-contract.md,component-lab.md,verification.md}`, relevant DESIGN/UX contracts and existing HTTP fixtures.

**Interfaces:** `mountAnalytics(region,{client,workspace})` returns `destroy()` and uses Task 6 endpoints. State labels are exactly Not configured, Draft configuration, Published—verification needed, User-confirmed verification, and Unavailable/error, with separate consent/setup blockers.

- [x] Write regression DOM tests for provider choice, retained draft on error, typed validation, save-versus-publish distinction, current configuration fingerprint, manual verification labeling, provider links, missing consent and unavailable host recovery. A link click must never mark setup complete.
- [ ] Run the targeted test file; confirm expected failures.
- [x] Implement the provider-neutral step sequence: provider → public domain/config → review → draft save → publish → verify on the live website. Use the official Google/Plausible documentation linked by the approved spec, checking it again only if its relevant contract has changed. Show real installation/connection states and Open provider dashboard, not mock charts or fake tests.
- [x] Document local login, first-owner setup, Studio cookie migration requiring one fresh login, exact host/client/allowed-origin configuration, platform profile ownership, revoked-session recovery and analytics consent/reporting boundaries. Never include actual passwords, grants or client secrets.
- [x] Run `npm test`, `npm run test:studio`, `npm run test:backend`, `npm run typecheck`, `npm run check`, `npm run format:check`; run targeted PixelCore bridge/auth tests and `npm run check:ui` from `pixelcore-frontend`. Run additive migration drift checks in both backends. Fix failures only within this change's scope.
- [x] Run the installed Premium strict audit and Impeccable static detectors against changed surfaces. Review generated static findings and all identity/gateway/analytics diffs natively; do not delegate or use builds/browser inspection.
- [x] Record exact results and unperformed visual acceptance in `docs/verification.md`; report working routes, migration/configuration requirements and any externally blocked platform/provider setup accurately. Mark this plan complete only when the approved functionality and applicable checks pass.

## Review outcome

Spec coverage and interface names were checked across all seven tasks. The five Review Focus conditions have explicit test owners. Public/guest routes remain independent of the Studio login gate. Platform connection configuration is explicit and fails closed. There is no dependency on an unavailable Medframe/DineEase checkout, external identity service, paid analytics subscription or a build step.

Implementation approved and delivered natively without agents on 24 October 2026. All seven functional tasks are complete; detailed verification is recorded in `docs/verification.md`. Studio and local PixelCore migrations have been applied. No application builds, browser/visual inspection or manual acceptance were performed. The platform frontend/backend were not started; integration is covered by host authorization tests and a two-origin native HTTP fixture.

Execution note: the initial session tests were run before implementation and failed as expected. Other regression coverage was added during implementation and verified after the corresponding changes; the planned pre-change red runs were not claimed as performed. Unchecked red-run steps below record that historical distinction, not outstanding product functionality.
