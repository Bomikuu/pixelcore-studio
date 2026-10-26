# Studio dashboard, identity and analytics setup

Status: approved and implemented on 24 October 2026. Execution: native implementation in this session, without agents. Verification and external platform/consent setup boundaries are recorded in docs/verification.md and docs/studio-accounts.md.

## Intent and confirmed decision

Give Pixelcore Studio one recognizable authenticated home, retaining identity across its dashboard, builder and Component Lab. Local credentials remain available. A user already authenticated to an integrated platform enters that platform's business workspace without another password prompt. The user explicitly selected the platform business workspace over a separate Studio workspace.

The supplied dashboard screenshot is the interaction/layout reference. Preserve the existing Pixelcore character icon, small live-text wordmark, Manrope, shared blue/neutral tokens, default light mode and optional dark mode. Do not copy the screenshot's invented performance/traffic numbers.

## Diagnosis from the current implementation

- `examples/app.js` opens `/api/demo/bootstrap/` and mounts the editor without querying `/api/studio/session/`. Returning from Component Lab therefore provides neither a shared login gate nor account feedback in the builder.
- `studio/web/lab.js` independently checks Studio's Django session. `session_data` currently treats active staff status as the definition of being authenticated. General platform users need authenticated identity separated from component-administration permission.
- `python/website_builder/demo_hooks.py` grants local-demo authorization based on DEBUG, loopback and a fixed tenant rather than an authenticated user. This must remain restricted to an explicitly designated local sample workspace, behind the Studio gate, rather than becoming platform authorization.
- Studio inherits Django's default `sessionid` and `csrftoken` names. PixelCore also leaves these names at their defaults. Cookies are not isolated by port, so separate localhost applications can overwrite one another's Django cookies. This is an additional collision risk; no browser observation has established it as the cause of a particular logout.
- PixelCore's main app uses short-lived JWT access tokens and an HttpOnly refresh cookie restricted to `/api/auth/`. Its Pinia auth store restores sessions. The installed builder already uses the host's authenticated API and owner/admin/manager business authorization.
- Standalone Studio and PixelCore have different databases. Reusing a username, email, browser flag or unrelated session cookie cannot prove a shared identity or establish business access.

## Architecture choice

Recommended: a shared Studio shell and explicit host identity/workspace adapter. Integrated hosts prove identity using their existing auth flow and a short-lived, one-use server exchange. Studio continues to use its own cookie session. Host websites, records and authorization remain in the host.

Alternatives considered:

- Share raw session cookies/databases: couples otherwise installable applications, collides on localhost and does not fit PixelCore JWT authentication. Rejected.
- Keep standalone entirely separate and merely link to each host: simpler, but fails the confirmed business-workspace requirement. Retain only as a fallback when an integration is unavailable.

Do not introduce an external identity provider, analytics subscription, Docker service or heavyweight frontend dependency for this work.

## Routes and shared shell

- `/login`: shared credential form, platform connection status, enrollment only under the existing first-local-owner conditions. Preserve the intended internal return route; reject external return URLs.
- `/studio`: business/workspace overview after sign-in. `/` routes to this home; editor entry moves to `/studio/builder`.
- `/studio/builder`: selected website editor using either the explicitly labeled local sample context or the verified platform adapter.
- `/studio/analytics`: provider setup, installation state and links to real reports.
- `/studio/settings`: profile and account/workspace settings with permission-sensitive fields.
- `/studio/components`: existing Component Lab, reached through the same shell and restricted to Studio component administrators.
- `/published`, review links and approved public component assets retain their intended public/guest authorization, independently of the Studio login gate.

Shell: compact brand/site header; slim icon rail with custom hover/focus tooltips; contextual navigation; flexible main region; avatar menu with display name, identity source, settings and sign-out. Show the active platform and business explicitly. Platform contexts cannot silently fall back to sample data.

Dashboard content: selected business/site, draft versus published state, pages and last edit time from actual authorized records, recent editing activity where available, an Open builder action, publication readiness and analytics setup status. No placeholder visitor counts, conversion rates or synthetic performance score. Do not offer A/B testing or eye tracking until implemented.

## Session and platform identity contract

1. Introduce Studio-specific session and CSRF cookie names. All Studio transports use the configured CSRF name; do not change host package defaults globally. Rotate identity on login and invalidate it on logout. Existing local credentials remain valid; cookie renaming may require one new sign-in.
2. Every protected Studio entry resolves the shared server session before loading workspace data. Navigation and reload restore the session. Anonymous access cannot fetch protected data merely by skipping the frontend.
3. Separate `authenticated`, `identitySource`, active workspace and named capabilities such as `editWebsite` and `manageComponents`. A verified platform user is not automatically a Studio administrator.
4. Platform detection uses only explicitly configured trusted platform origins and the host's existing session restoration mechanism. Never scan arbitrary ports or read another app's browser storage. A signed-in integrated platform can complete a silent verified connection; an unavailable or signed-out platform leaves local sign-in usable. Multiple eligible business contexts require a workspace choice.
5. The handoff binds issuer, stable subject, business/tenant, audience, initiating Studio session/state, exact return origin and a one-use code with a 60-second lifetime. Consume atomically. Never accept identity or permission claims supplied only by the browser. No access/refresh token in a URL or client persistent storage.
6. The host authorizes owner/admin/manager access on exchange and on every business-data/editor operation. Reject replay, expired codes, mismatched state/audience/origin, inactive users, removed memberships and cross-business access. Identity mappings use issuer plus stable subject; never merge accounts by email alone.
7. Keep upstream credentials or restricted grants server-side, scoped to the selected workspace. A narrow allowlisted workspace transport may forward builder operations; it must never become an arbitrary URL proxy. PixelCore remains the source of its documents, live bindings, media, revisions, publishing and permission checks.
8. Sign-out ends the Studio session and clears Studio recovery/context state. Label its scope; do not silently sign the user out of unrelated platforms. Explicit sign-out must suppress immediate silent re-login until the user chooses to reconnect. A host revocation/expiry produces a reconnect state and preserves unsaved editor work through the existing recovery mechanism.
9. Use existing PixelCore authentication for the first host integration. Keep the host contract reusable for Medframe/DineEase; do not claim those integrations are activated or modify unavailable/protected projects.

## Profile, avatar and settings

- Display an actual avatar when available, otherwise accessible initials. Share the avatar/name across dashboard, builder and Component Lab. No external avatar lookup service.
- Local Studio accounts can update their display name, email and avatar and change their password with current-password verification. Keep the current username stable unless a separate account-renaming contract is established.
- Avatar upload accepts decoded JPEG/PNG/WebP images, enforces a 2 MB input limit and maximum dimensions, re-encodes to a fixed image rendition, strips metadata and rejects SVG/animated/executable payloads. Avatar rendering reserves dimensions and has an error fallback. Allow explicit replacement/removal of one's own avatar.
- Platform identity fields are supplied by the host and link to its account settings. Changes must use that host's supported profile API; do not create a misleading editable local copy.
- Appearance uses the existing preference. Workspace/business settings and analytics configuration follow host roles; unauthorized controls are explained and server operations still reject them.
- Labeled forms preserve input on failures, disable duplicate submits, show inline field errors and save feedback, and guard against losing unsaved changes. Password fields support password managers, paste and accessible reveal controls.

## Analytics setup guide

Provide a real guided setup surface, not an analytics mock dashboard. Initial providers: Google Analytics and Plausible, plus None. Setup is tied to the selected website and stored through its owning workspace adapter.

Steps: choose provider; select/confirm the public domain; enter provider configuration; review what will be installed; save configuration as a draft; publish through the existing publication flow; open the live site; verify receipt using the provider's real tools. An ID entered or a successful save is not proof of incoming traffic.

States: Not configured, Draft configuration, Published—verification needed, User-confirmed verification, Unavailable/error. Only label machine verification successful when a real supported provider response proves it. Opening instructions alone never completes a step. Persist the user's checklist progress and distinguish their confirmation from provider verification.

GA guide: create/select a property and web data stream, use the identifier provided by Google, then verify the published site with Realtime/DebugView. Plausible guide: add the site, obtain its current site-specific installation configuration and use its installation verifier. Link to current official instructions rather than assuming a legacy script URL.

Only approved structured provider configuration may affect the published page. Do not accept arbitrary script HTML or interpolate unchecked URLs. Reuse the host's consent policy where required; do not bypass its choice or track Studio/editor/review traffic as public visitors. Provider secrets, reporting API credentials and private dashboard results must remain server-side. No external account creation or paid service activation in this task.

Report ingestion and charting are a separate capability: if no reporting API is connected, show setup progress and an Open provider dashboard action. Tracking installation does not itself provide report-reading permission. Performance scores require actual measured evidence and are outside this initial setup scope.

Sources checked 24 October 2026:

- [Google Analytics setup](https://support.google.com/analytics/answer/14183469?hl=en)
- [Google Analytics troubleshooting and verification](https://developers.google.cn/analytics/devguides/collection/ga4/troubleshoot?hl=en)
- [Plausible tracking installation](https://plausible.io/docs/plausible-script)
- [Plausible integration troubleshooting](https://plausible.io/docs/troubleshoot-integration)

## Responsive and interaction requirements

Reuse canonical controls, existing SVG icons and light/dark tokens. Match the reference's spatial hierarchy: header, icon rail, contextual sidebar, overview content. Keep the small wordmark already requested by the user. Use blue for primary actions/current selection and neutral surfaces for supporting structure.

At narrow widths, collapse contextual navigation into an accessible menu and stack content in reading order. Keep the current business, identity, builder entry and account access reachable. Use semantic links for navigation, visible focus, correct selected state, stable image/control dimensions and custom tooltips. No tooltip may contain the only accessible name. Respect reduced motion and retain keyboard alternatives.

Loading, network failures, expired sessions, missing membership, unavailable platform, empty website lists, missing avatars, invalid configuration, unsaved settings and reconnect states must each have an actionable UI. Render no controls for future functionality that merely look clickable.

## Delivery boundaries and acceptance

Deliver in order: shared session gate and cookie isolation; verified PixelCore business context; dashboard/navigation and builder integration; profile/settings; analytics guide and publication integration. Keep the importer and Studio shell outside installed runtime packages. Public renderers remain independent of Studio/editor/review runtime code.

Automated verification must prove:

- Studio login survives reload and dashboard → builder → Lab navigation; unauthenticated APIs reject access; distinct local cookie names avoid host collisions.
- Silent handoff succeeds only for an authenticated, authorized host business; replay/expiry/state/audience/origin mismatch and removed membership fail; platform users cannot approve component imports without a separate explicit grant.
- Workspace data and operations remain in the correct host/tenant, including drafts, live records, global sections, upload, review and publication. No sample-data fallback on failed platform connection.
- Profile authorization, current-password checks, image validation/limits, avatar fallback and settings persistence are enforced server-side and in automated DOM interactions.
- Analytics validation, draft/publication boundary, setup progress, honest verification labels, unsupported-provider recovery and suppression on editor/review routes work as specified.
- Navigation and forms support keyboard focus, accessible names, light/dark preference, cleanup of pending work and duplicate-submit prevention.

Run targeted shared frontend/Django tests, host bridge/auth tests, typecheck, syntax/format checks and PixelCore `npm run check:ui` after frontend changes. No builds, visual tests, browser inspections or manual verification unless the user explicitly requests them. Documentation-only preparation needs no application test run.
