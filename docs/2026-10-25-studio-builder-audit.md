# Studio and website builder audit — 25 October 2026

Scope: standalone dashboard, editor, guest review, shared rendering and the PixelCore integration. This is a source and automated-behavior audit, not visual acceptance. No application code, data, account, publication or dependencies were changed. No agents, builds, browsers, screenshots or manual application checks were used.

## Verdict

**Implementation integrity: pass, with incomplete workflows.** The product has a coherent native editor, shared renderer, canonical controls, global typography, deliberate light/dark tokens, tenant authorization and separate draft/publication/review boundaries. It should prioritize completing those workflows before adding more effects or unrestricted positioning.

**Provisional code-audit health: 12/20.** This measures the reviewed implementation, not aesthetic quality, browser performance or WCAG conformance.

| Dimension                | Score     | Evidence and remaining gap                                                                                                                                                            |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility            | 2/4       | Named controls and existing automated accessibility checks pass; nested keyboard review selection anchors to the wrong element.                                                       |
| Performance              | 2/4       | Public renderer stays separate from editor; editing rewrites the whole canvas and libraries return complete documents.                                                                |
| Responsive design        | 2/4       | Width breakpoints and modal/mobile layouts exist; fixed minimum editor heights conflict with the clipped full-height Studio wrapper. Compact targets also need a touch-specific pass. |
| Theming                  | 3/4       | Central light/dark roles and separate website palettes are consistent. Font availability needs a real registry. No visual contrast certification was attempted.                       |
| Implementation integrity | 3/4       | Honest sample/analytics labeling, host-owned actions and revision boundaries are sound. Truncated discovery and scattered readiness checks leave misleading states.                   |
| **Total**                | **12/20** | **Acceptable; significant workflow work remains.**                                                                                                                                    |

Nine findings: **0 P0, 2 P1, 7 P2, 0 P3**. Two defects were reproduced through isolated automated DOM scenarios; other findings distinguish source-confirmed gaps from layout/performance risks that require later browser evidence.

## Findings

### F1 — [P1] Older websites and sources become undiscoverable

- **Locations:** [standalone overview](../studio/server/component_lab/workspace.py#L22), [dashboard filters](../studio/web/dashboard.js#L76), PixelCore `pixelcore-backend/content/studio_bridge.py:73–77`.
- **Category:** Implementation integrity.
- **Evidence:** Both overviews return only the first 100 websites. PixelCore also caps each source type at 100. There is no cursor or next-page contract. Dashboard filters operate on that limited array, while summary counts correctly cover the entire tenant.
- **Reproduction:** Supply 100 recently edited published websites plus a tenant summary containing one older unpublished website. The Unpublished filter renders zero rows and says “No unpublished changes.” despite the summary showing one. An automated DOM scenario confirmed this exact contradiction.
- **Impact:** Users cannot discover older work through the dashboard or source chooser, and empty-state messages can be false. Existing direct links may still work.
- **Recommendation:** Add authorized server search, sorting, publication filters and cursor pagination. Keep summary counts global; distinguish an empty result from an incomplete page. Paginate source selection too.
- **Suggested command:** `/impeccable harden`.

### F2 — [P1] Keyboard review comments attach to an ancestor

- **Location:** [review keyboard listeners](../packages/review/src/index.js#L204), with click selection at line 183.
- **Category:** Accessibility, WCAG 2.1.1 keyboard operation.
- **Evidence:** Every nested rendered node gets an Enter handler calling its own `click()`. The key event bubbles through ancestor handlers, which select their own nodes in turn.
- **Reproduction:** Mount a review with a heading inside a section, dispatch a bubbling Enter key on the heading and post a comment. The posted `anchor.nodeId` differs from the heading ID. The isolated automated scenario reproduced the mismatch.
- **Impact:** A keyboard reviewer comments on a different element from the one they selected. Keyboard support exists, but its result is incorrect.
- **Recommendation:** Delegate activation once or guard the originating node and stop propagation. Prevent default where necessary. Test nested headings, links, pins, Enter and Space without triggering page actions.
- **Suggested command:** `/impeccable harden`.

### F3 — [P2] Font choices exceed reliably available fonts

- **Locations:** [allowed families](../packages/core/src/theme.js#L102), [bundled font faces](../packages/renderer/src/fonts.js#L1).
- **Category:** Theming.
- **Evidence:** The picker permits Newsreader, Bodoni Moda and Italiana, but the bundled registry supplies only Manrope and Cormorant Garamond. System families depend on the device. Server-only rendering deliberately omits local file font URLs and relies on host font setup.
- **Impact:** A font can be selected and saved while the browser renders a fallback. Layout and branding can differ between editor, public page and another device.
- **Recommendation:** One licensed font registry should supply picker options, load status, asset URLs, preview and host/SSR setup. Clearly label system fonts. Preserve the existing global primary/secondary font policy; do not add per-element family overrides.
- **Suggested command:** `/impeccable typeset`.

### F4 — [P2] Canvas updates replace the whole iframe document

- **Locations:** [render cycle](../packages/editor/src/mount.js#L1498), [canvas writer](../packages/editor/src/mount.js#L1302).
- **Category:** Performance.
- **Evidence:** The main render path rebuilds layers and inspector and calls `renderCanvas()`. That method opens, writes and closes the iframe document, then reattaches listeners/enhancements. Existing focus/caret/scroll preservation mitigates consequences but does not remove the work.
- **Impact:** Work scales with page size, even for small committed changes. Media and enhancement state can be recreated. Actual latency and browser jank were not measured.
- **Recommendation:** Separate selection updates from document updates, patch changed nodes/styles by stable ID, batch work and preserve untouched media. Add deterministic mutation-count regression checks before an explicitly authorized browser performance pass.
- **Suggested command:** `/impeccable optimize`.

### F5 — [P2] Library browsing fetches full designs before selection

- **Locations:** [template list](../python/website_builder/views.py#L200), [section list](../python/website_builder/views.py#L170), [payload default](../python/website_builder/services/library.py#L10), [manager load](../packages/editor/src/workspace/library-manager.js#L51).
- **Category:** Performance.
- **Evidence:** List responses serialize complete documents/nodes for up to 100 designs. The manager subsequently fetches the selected design separately. Rendering only eight cards at a time does not reduce the initial network payload.
- **Impact:** Larger personal libraries increase transfer, parsing and memory before a user chooses a design. No measured payload or timing claim is made here.
- **Recommendation:** Return paginated summaries and thumbnail references. Fetch a document only for selection/preview/import. Preserve version checks and tenant isolation.
- **Suggested command:** `/impeccable optimize`.

### F6 — [P2] Publish readiness is spread across separate tools

- **Locations:** [Publish dialog](../packages/editor/src/mount.js#L396), [page checks](../packages/editor/src/workspace/page-settings.js#L63), [missing media analysis](../packages/core/src/media.js#L26).
- **Category:** Implementation integrity; workflow gap.
- **Evidence:** Publish shows contrast findings. Heading/alt/description checks live in page settings; missing-reference checks live in media. History already supports comparison, but publication does not present one combined summary of these results.
- **Impact:** A nontechnical owner must remember which tools to inspect before publishing. Existing validation is useful but does not provide a complete readiness workflow.
- **Recommendation:** One Review & publish screen: changes since live, affected global sections/pages, missing media, unresolved bindings, headings/alt text, links, contrast and analytics state. Link each finding to its element. Separate blockers from acknowledged warnings; host authorization remains authoritative.
- **Suggested command:** `/impeccable clarify`.

### F7 — [P2] Analytics setup cannot activate tracking in current PixelCore pages

- **Locations:** [Vue consent default](../packages/vue/src/index.js#L14), [consent gate](../packages/renderer/src/analytics.js#L3), [setup explanation](../studio/web/analytics.js); PixelCore `components/site/StorefrontPage.vue` and `components/event/BuilderEventWebsite.vue`.
- **Category:** Implementation integrity; integration gap.
- **Evidence:** Consent defaults to false; the inspected PixelCore public page integrations do not provide an affirmative `analyticsConsent` value. The setup UI already explains that tracking remains disabled without host integration.
- **Impact:** Saving and publishing a provider configuration does not produce visits from these pages. This is intentional gating, not a reason to enable tracking unconditionally.
- **Recommendation:** Connect the host's actual consent state and revocation to the renderer. Show distinct Not configured / Saved / Published / Waiting for consent / User-confirmed states. Keep verification truthful and begin reports only after a real reporting integration exists.
- **Suggested command:** `/impeccable onboard`.

### F8 — [P2] Builder sign-out errors use a potentially clipped feedback destination

- **Locations:** [global feedback](../studio/web/studio.js#L27), [builder wrapper](../studio/web/styles-shell.js), [editor host sizing](../studio/web/builder.js#L110).
- **Category:** Implementation integrity.
- **Evidence:** A clean editor's failed sign-out appends an error paragraph after the full-height editor host in `.builder-main`, whose overflow is hidden. Dirty sign-out uses a dialog and has a different error surface.
- **Impact:** The clean-editor failure message is at risk of being outside the visible clipped area. This is a source-confirmed routing/sizing conflict; actual clipping was not browser-tested.
- **Recommendation:** Route account failures to the editor's persistent status region or a visible account error dialog, with Retry. Test both clean and dirty editor paths under rejected sign-out requests.
- **Suggested command:** `/impeccable harden`.

### F9 — [P2] Short viewports conflict with minimum editor heights

- **Locations:** [editor height and mobile rules](../packages/editor/src/workspace/styles.js#L3), [Studio clipping](../studio/web/styles-shell.js).
- **Category:** Responsive design.
- **Evidence:** Editor host/builder minimum height is 640px, reduced only to 600px under 650px viewport width. Studio constrains the mounted builder to `100dvh` and hides overflow. The editor also has many 26–36px controls without a coarse-pointer target expansion.
- **Impact:** Short laptop windows, landscape phones and reduced viewport space can place editor content below the clipped boundary. Small targets reduce touch usability. No real-device or visual result is claimed, and a 44px preference is not by itself proof of a WCAG failure.
- **Recommendation:** Allow editor children to shrink with `min-height:0`, keep task panels independently scrollable and preserve reachable publication/status actions. Add coarse-pointer target spacing and cover short-height layouts before visual acceptance.
- **Suggested command:** `/impeccable adapt`.

## Feature recommendations

These are additions to existing capabilities, not claims that the corresponding functionality is absent in every form.

| Order | Improvement                   | Concrete behavior                                                                                                                                                                                                                                                                                                                     | Relative scope |
| ----- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1     | Reliable website management   | Fix F1/F2 first; then searchable/sortable website and source lists, meaningful thumbnails, clickable summary filters, retained query state and separate live-preview/editor links.                                                                                                                                                    | Medium         |
| 2     | Review center                 | Manage existing review links, expiry, view-only/comment access and revocation. Open/resolved filters, unread counts, recorded viewport and jump-to-element. Backend resolve/revoke operations and guest threads already exist; extend them rather than replacing them. Notifications require a separate delivery preference/contract. | Medium         |
| 3     | Review & publish              | Combine F6 checks with existing draft/live comparison; identify who/what is affected by shared layout publication, show the live destination, and keep failed publication retryable.                                                                                                                                                  | Medium         |
| 4     | Context-aware template packs  | Filter templates by Landing / Storefront / Event / Wedding and host capabilities. Show required fields, connected record, fallback state and unavailable widgets before applying. Expand designs after the context contract is clear.                                                                                                 | Medium         |
| 5     | A live-data status workspace  | Show bound source, last successful refresh, missing fields, collection loading/empty/error states and a deliberate Refresh action. Let owners design with an example state without confusing samples with real records.                                                                                                               | Medium         |
| 6     | Complete analytics activation | Finish F7, then implement a real provider reporting adapter if in-Studio reports are wanted. Use RSVP-start/completed or product-action events only through authorized host events, with no guest-token or private-record collection.                                                                                                 | Medium–large   |
| 7     | Host-backed forms             | Contact/inquiry blocks with preset layouts, required fields, success/error states and submissions in the host. Implement validation, spam controls and an explicit submission endpoint before advertising a working form.                                                                                                             | Large          |
| 8     | Publication governance        | Optional editor/publisher permissions, approval requests, activity history and scheduled publish/unpublish in the host. Handle timezone, missed schedules, cancellation and authorization rechecks.                                                                                                                                   | Large          |

Relative scope is not a delivery estimate. No external competitor research was performed; these recommendations follow the inspected product and existing user goals.

### Wedding RSVP integration

Extend the existing native RSVP integration rather than creating a generic form that duplicates guest records. Wedding context should select the actual event and expose approved couple names, date, venue, public schedule and media. The builder styles the RSVP widget container and its empty/closed/success/error states; the host owns invitation identity, token, guest limits, meal choices, deadlines and submission authorization.

Preview must explain whether it shows sample/open/closed/already-responded state. Anonymous review links remain inert and do not obtain invitation tokens. A publication check should distinguish “RSVP widget connected” from “RSVP is accepting responses.” Add optional accommodation, FAQ, travel, directions and schedule presets backed by approved public content.

### What to defer

Simultaneous multiplayer editing, arbitrary executable embeds in the authenticated editor, unrestricted free positioning and large effects libraries should follow reliable publication, review and measured performance. The isolated Component Lab already provides the appropriate optional path for approved interactive components. Medframe activation and registry publication remain separate rollout decisions.

## Patterns to preserve

- One header/navigation owner per workspace; editor account actions mount into its own header.
- Native source-owned Shadcn input recipes and canonical controls. The standalone app is not running Vue Shadcn components; its native port should stay aligned intentionally.
- Website-wide primary/secondary fonts, illustrated presets and Advanced styling disclosure.
- Real tenant-wide summary data; explicit sample labeling and no invented traffic figures.
- Separate saved drafts, publication, immutable review snapshots and optimistic conflicts.
- Host-owned authorization, operational RSVP/commerce actions and data access.
- Optional isolated component runtime and public renderer independence from editor dependencies.

## Evidence and limits

- **17 focused automated frontend tests passed**: accessibility, Studio chrome/input/summary, transport, review escaping, global font policy/template lifecycle and analytics consent behavior.
- Two additional isolated Happy DOM reproductions confirmed F1's false empty result and F2's wrong keyboard anchor. They did not modify application files or persistent records.
- Premium strict source audit: **zero errors/warnings**.
- One Impeccable detector pass: **zero primary findings, three advisories**. Two are intentional wedding-template palette values in `renderer/src/library.js:652,659`, distinct from editor chrome; the other is the RSVP/widget fluid heading endpoint in `widgets.js:81`. They are documentation/alignment advisories, not verified UI defects, and are excluded from the nine findings.
- Graphify's existing host graph was queried. Its 356-node corpus mostly covers older host/demo relationships, so current shared-builder facts were verified directly from source; no missing graph edge was treated as evidence of a missing feature.
- Jev favored completing reliable workflows over effects/multiplayer with confidence 1.0. Input contained generic capability/gap descriptions only, no secrets or private records. Its judgment is advisory; source and reproductions establish the findings.
- No full backend suite was rerun for this documentation-only audit. No builds, browser inspections, visual tests, screenshots, GPU/touch measurements or WCAG certification were performed.

## Suggested implementation order

1. `/impeccable harden`: F1, F2 and F8, including focused regressions.
2. `/impeccable typeset`: F3 font registry and host delivery.
3. `/impeccable adapt`: F9 short-height and touch behavior.
4. `/impeccable optimize`: F4/F5 canvas updates and lazy library payloads.
5. `/impeccable clarify`: F6 unified publication readiness.
6. `/impeccable onboard`: F7 real consent-connected activation.
7. `/impeccable shape`: Review center and context-aware template/data workflows.
8. `/impeccable polish`: completed flows, within the user's verification policy.

These can be implemented individually, together, or in a chosen order. Re-run `/impeccable audit` after fixes to reassess the findings.

## Implementation follow-up

The six recommended workflow improvements and F1–F9 have implementation and automated regressions in the 25 October follow-up. See `verification.md` and `superpowers/plans/2026-10-25-studio-audit-improvements.md`. Font authoring now offers bundled/system choices and identifies unavailable legacy selections. Canvas writes now patch stable nodes during edits, while generating/diffing the render tree still scales with page size. No new visual score, browser latency measurement or WCAG certification is inferred from this implementation. Host-backed forms and publication governance remain later roadmap items, beyond the six approved workflow priorities.
