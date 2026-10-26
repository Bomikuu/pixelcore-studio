# Website Builder UX contract

## Shared Studio account navigation

Standalone dashboard, builder, Component Lab, settings and analytics resolve one server session before protected data. Login supports local credentials and verified configured-platform connection; return destinations stay internal. Distinct cookies avoid localhost host collisions. Authentication and component administration are separate capabilities. Header identity, avatar, business and settings remain consistent. Studio logout suppresses silent re-login and leaves unrelated platform sessions intact.

Dashboard pages have one header and one labeled navigation sidebar. On phones, a menu button discloses that same navigation; Escape/outside click closes it. Mounted builder pages remove the outer shell chrome and insert account actions into the editor's sole header. Builder source selection retains the regular shell until an editor is ready.

Overview summary tiles use full-tenant counts and activity independently of the displayed row limit. All/Published/Unpublished filters preserve state in the URL and show contextual empty states. Form inputs use the shared native Shadcn port; password visibility is an icon inside the field with an accessible changing label and preserved value/caret.

Platform contexts retain host data, authorization, media, publication and guest-review origin. Failed connections offer reconnect, never sample fallback. Local profiles are editable; platform profiles link to their host. Profile/security dirty state stays separate. Analytics distinguishes draft, publication and user-confirmed verification; link clicks never complete setup. Public tracking requires affirmative host consent and stays disabled for editor/review/Studio routes. No synthetic traffic or performance metrics.

## Sources

PRODUCT.md and docs/implementation-plan.md define product behavior. Host authorization and media policies are enforced in the host adapter. The builder never authorizes business actions.

## Canonical UI Map

| Capability                      | Owner                                       | Decision                                                         |
| ------------------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| Button, field, textarea, select | packages/editor/src/components/ui/index.js  | Shared semantic controls; native select and color popup accepted |
| Form and validation             | Same field owner and inspector              | Labels, inline errors, no native validation bubbles              |
| Dialog                          | Same UI owner                               | Native dialog; focus placement, Escape, restoration              |
| Scrollbar                       | packages/editor/src/workspace/styles.js     | Global shadow-root baseline, forced-colors fallback              |
| Save, conflict, retry           | packages/editor/src/workspace/save-state.js | Debounce; no silent overwrites; retained pending draft           |
| Undo and deletion               | packages/core/src/operations.js             | Reversible document operations; fresh IDs on duplication         |
| Drag and keyboard movement      | packages/editor/src/layout/index.js         | Same move operation, non-drag buttons                            |
| Toast/status                    | Persistent editor status live region        | Critical errors remain visible until resolved                    |
| CRUD                            | Editor command dispatcher                   | Add/read/edit/remove, Undo, stable selection                     |
| Search                          | Template/Add library dialog                 | Search by name/description and category; eight cards per batch   |

## Behavior ledger

Inline text commits on completed edit and respects IME. Draft saves never publish. Save failures retain edits; Retry explicitly resubmits. Conflict requires reloading or deliberate export, never an automatic overwrite. In-app host navigation may consult hasUnsavedChanges(); actual unload uses the browser lifecycle guard.
Templates replace the draft only after preview and explicit Apply to this page; replacement is undoable. Brand import previews before applying. Reordering preserves identity and connection references. Review threads stay on their saved snapshot. Guest display names are unverified. Review-only capabilities grant no workspace editing or business actions.

## Accessibility and locale

WCAG 2.2 AA target, not a certification. English editor; host locale and currency for dynamic data. Drag has button and keyboard alternatives. Ctrl/Command shortcuts do not intercept text editing or IME. Numeric free-form controls provide a non-drag alternative.

## Verification

Automated Node/core, DOM/editor, adapter SSR, backend and static policy checks. No builds or visual/manual checks without explicit request. Free-form enabling requires separately recorded browser performance measurements; DOM timing alone is not that evidence.

## Canonical UI resolution

| Capability     | Canonical owner                            | Source of truth                           | Allowed variants                | Verification                 |
| -------------- | ------------------------------------------ | ----------------------------------------- | ------------------------------- | ---------------------------- |
| Select/Listbox | packages/editor/src/components/ui/index.js | Native select; OS popup geometry accepted | Text and enum choices           | tests/accessibility.test.mjs |
| Form           | packages/editor/src/components/ui/index.js | Shared labeled fields and inline feedback | Input, color, numeric, textarea | tests/editor.test.mjs        |
| Scrollbar      | packages/editor/src/workspace/styles.js    | Standards properties and WebKit fallback  | Panel and canvas geometry       | npm run check                |
| Toast          | packages/editor/src/mount.js               | Persistent status region                  | Saved, error, conflict, offline | tests/editor.test.mjs        |
| CRUD           | packages/core/src/operations.js            | Reversible operations, stable IDs         | Nodes and templates             | tests/core.test.mjs          |

## Redesigned studio

Template and Add libraries are separate protected-focus dialogs: search/category, real renderer preview, detail/device preview, compatibility explanation, explicit insertion/apply, cancel and focus recovery. Page identity remains stable on template replacement; one Undo restores prior content. Header/footer remain single regions and global edits publish separately from page edits. Saved sections are tenant-scoped copies.

First-run context has three short screens and preserves known source IDs; returning drafts bypass setup. Pages navigation uses host pages and the existing unsaved-navigation guard. On small screens tools/properties replace the canvas temporarily; returning to Layers restores it.

RSVP in editor/review is an inert sample. Private invitation pages mount the existing host RSVP component only after token authorization. Guest records and tokens never enter saved documents or shared review snapshots. Personalized routes/API responses are no-store/private/no-index/no-referrer. Native checkout/cart, event settings and guest authorization remain in the host.

## Font and template library behavior

The primary heading family and secondary body family are global theme settings. Individual selection shows its assigned family as information; element controls cannot change it. Applying a template keeps the destination pair, including responsive layouts. Existing family overrides are removed from new draft saves, and public rendering ignores legacy overrides.

Template creation/import stays inside the existing template popup, alongside Built-in and My templates. Add template copies the current page; Import JSON requires a valid file and previews it before saving. Name and optional description remain editable, and failures retain the file’s parsed content and entered values for retry. Saving adds the template to the tenant library and selects its preview; page changes require explicit Apply. Pending saves prevent duplicate submission. Cancel, Escape and close retain current page content. Read failures are announced with reopen-to-retry instructions. Unconfigured storage disables creation/import with an explanation. Export uses the portable versioned format and excludes source context. Native labeled file controls are owned by the shared UI factory.

## Priorities 1–4

History has labeled draft/live revisions, explicit draft/live layout comparison and confirmed restore-as-new-draft. Comparisons use current approved live data in both previews. Restore errors retain context and optimistic versions. No historical operational records are restored.

Recovery is document-only and requires a host-issued user/tenant/site scope. Its restore window is seven days. Decide later retains an older recovery; subsequent saves cannot overwrite or clear it. Stale versions permit export/discard. Inline work created during a save survives that save’s completion. Logout emits the session-end event, tears down editors and removes builder recovery keys; late requests cannot recreate them. Quota failures report an export fallback.

Data has an explicit approved catalog, typed target choices and protected connections. One repeater card edits every rendered row. Filters/sort/offset/page size operate on the supplied public collection window. Unavailable, loading, failed and empty sources are distinct. Operational widgets cannot be repeated. Detach uses the first visible row and preserves formatted text. Selected nodes refresh the Data and Shared sections panels immediately.

Shared sections distinguish source drafts from live versions. Creating a source retains the local section independently. Link is explicit; editing happens in an isolated editor. Save shared draft and Publish shared section are separate operations; publish shows affected page titles. Detach is undoable; an unavailable source offers confirmed fallback-copy recovery. Anonymous JSON includes only published source content. Review snapshots remain fixed. Nested sources, hidden page-draft publication and local lock bypasses are prohibited.

Responsive controls state which layer owns a value, reset properties independently and preserve tablet-to-phone inheritance. Phone precedence is independent of edit order. Visibility, padding sides, percentage widths and layout flow are breakpoint-aware. Content motion/free positioning stays Desktop-only. Publishing failures retain their modal error and retry controls; canvas Save routes to the same command as chrome and respects IME/native text undo.

Saved-design management reuses the canonical field/button/modal owners. Archive hides entries without deleting page content; permanent deletion uses an explicit inline confirmation. Template writes use optimistic versions and immutable snapshots. Media uploads disable duplicate submission, retain failures and retry, and use the authenticated host transport. Page metadata honors stronger host noindex rules. Public FAQ uses native details/summary, tabs use progressive enhancement with arrow/Home/End navigation and cleanup, and videos play only on request. Gallery selection exposes real image labels, not a required ID-entry workflow. Existing source/binding and shared-section boundaries remain authoritative.

Appearance is editor-local: light by default, dark available, stored preference independent of website data. All chrome surfaces inherit the host's active token set, including dialog color-scheme. Sidebar/toolbar help uses the canonical custom tooltip provider (hover, keyboard focus, Escape, viewport bounds, cleanup); no native browser title tooltip on buttons. Primary/selection commands may carry one decorative SVG, while lists and filters remain quiet.

Selection reveals/focuses its canvas element, expands layers, updates the inspector and opens the mobile inspector where appropriate. Edit properties focuses a control explicitly; inline/IME focus is not stolen. Inspector commits preserve the active field, caret and scroll. Invalid IDs report an unavailable element. Boundaries/host capability gaps disable unsupported controls. Async library reads cannot reopen stale dialogs; section save guards duplicate submission and retries. Preview tabs/disclosures/links work, and Enter never turns containers into editable text. Host-owned private submission remains live-site-only.

Large tool workspaces share `workspace/tools-dialog.js`, using canonical field/button controls and native dialog focus/Escape behavior. Branding, Media, Shared sections and Data open here; Pages/Layers and contextual element settings remain beside the canvas. Only one management workspace opens, and top navigation switches its active tool. Closing restores focus to the original trigger or current tool's rail action. Choosing/inserting media or a shared/data element closes the workspace before canvas focus moves.

Media cards select before insertion. The Add media card opens inline upload controls, never a second upload modal. Typed file/alt/search state and duplicate-upload guards survive tool switching. Closing does not lose a completed upload from the editor's approved asset list. Failed uploads retain the selected file for retry. Source reads cannot reopen an editor after the workspace closes. Branding controls preserve focus and draft preview during updates; global theme controls are not repeated in the page sidebar. Existing protected publication confirmations and isolated shared-section editing remain separate focused workflows.

Element appearance uses illustrated preset buttons above a collapsed Advanced styling disclosure. Choose a button, card, text, image, section or column style with one action; one Undo restores the previous appearance. Presets do not replace content, links, bindings, global fonts, free positioning, visibility or unrelated dimensions. Application targets the current breakpoint and preserves other explicit screen overrides. Color roles follow later branding changes. Repeated activation of the already-selected choice makes no history entry. Detailed edits that change a preset-owned property show Custom style rather than a false selected preset. Advanced settings remain open through committed edits, preserve field/summary focus and reset closed when a different element is selected. Transparent backgrounds replace inherited images/gradients; contrast checks use the actual ancestor backdrop or request review for indeterminate media.

Component Lab is a standalone administrator workflow. First-owner setup is restricted to local debug, is atomic and requires a 12-character password. Management requests require active staff access and CSRF; the public catalog contains approved versions only. Upload → private draft preview → save defaults as another immutable draft → explicit catalog approval. Existing pages retain pinned approved runtime versions after catalog rollback. Native sections are cloned to new identities when inserted; interactive refs contain ID/version/settings with static renderer fallback.

The Lab reuses canonical el/button/field/filePicker, editor tokens and tooltip ownership. Upload/validation failures retain file/context; writes guard duplicate submission and preserve previously disabled controls. Unsaved defaults have a discard guard and unload protection. Viewport/theme/pause/restart controls act on the current preview; switching versions tears down prior frames and pending work. The optional runtime validates the message source/channel, forwards only declared public scalar inputs, observes visibility/reduced motion, supports abort/unmount cleanup and restores fallback content after errors. The importer, management Django app and Three.js remain outside installed editor/renderer code; optional catalog/runtime code activates only when configured. Review/SSR remains inert. Local development has separate UI/API/preview ports; hosted deployment is a separate operation.

## Audit improvements — 25 October 2026

Dashboard/source discovery filters before pagination and preserves query state. Counts remain full-tenant. Superseded responses cannot replace later results. Search failures retain results and provide retry. Analytics deep links select the requested website even outside the current overview page.

Review ownership operations recheck host permission and website/share association. Link creation accepts 1–30 days and view-only/comments; edits use the last expiry as an optimistic guard. Revocation cannot reactivate a secret. Guest keyboard activation selects exactly one originating node. Owner discussion can jump to the recorded width in the current draft; a deleted node reports that its old revision is needed.

Publication shows missing-media/unavailable-RSVP blockers separately from acknowledged content/link/binding/contrast warnings. Comparison uses current approved public data; it does not claim historical operational records. Publication remains an explicit version-checked host action and retries retain errors.

Refresh replaces approved runtime data after success, retains old data on failure, and ignores completion after teardown. It never changes the authored document. Font choices have an explicit availability class. Canvas patching preserves stable DOM/media; edit/preview mode changes reinitialize isolated interaction handlers.

PixelCore public website/event pages offer an explicit optional analytics choice per business/provider, default off. Preferences expire after 180 days; unavailable storage allows a session choice. Withdrawal disables collection, and cross-tab preference changes update the page. Invitation RSVP, workspace, Studio and review routes remain excluded. Provider reports are external; saved or user-confirmed setup is not independent traffic verification.

## Loading and error recovery — 26 October 2026

Loading text advances when actual requests advance; there are no invented percentages or rotating fake steps. The spinner is decorative and hidden from assistive technology, with one polite busy status. Reduced-motion users receive a static ring. The initial document has useful loading content and a JavaScript-disabled explanation before Studio mounts.

Page-level failures preserve their status category: 401 offers sign-in with a validated internal return destination, 403 offers account/workspace recovery, 404 returns to the dashboard, and network/service failures offer retry. Unknown Studio routes cannot silently become the overview. Retry prevents duplicate attempts; after a shell already exists, loading mounts inside its shadow root. API details render as escaped text. A failed placeholder image cannot remove the recovery actions. Inline form errors and unsaved editing workflows remain in place.

## Complete template behavior — 26 October 2026

Source: `packages/renderer/src/premade.js`, `library.js`, `render.js`, `widgets.js` and `packages/editor/src/workspace/context.js`. All six built-ins provide one header, contextual body and footer. Template compatibility still gates live collections and native RSVP; setup offers both compatible templates for the selected purpose and passes destination media. Landing copy starts as editable approved identity text; live product/event fields retain bindings. No guest response records are copied into templates.

The library lists the complete section outline and applies in one undoable operation. Host-owned frames and configured navigation remain authoritative. Without supplied navigation, links target actual sections with unique anchors, including repeated sections. Missing live titles have readable fallbacks. Footers render only supplied approved social profiles and contact details; external social links use safe HTTP(S) destinations and noopener/noreferrer. Review actions stay inert. Media comes from the destination library. Missing assets do not introduce foreign stock URLs or fabricated profiles. Automated coverage: `tests/premade-templates.test.mjs` and existing renderer, import/export, frame, repeater and undo suites.

## Template setup correctness — 26 October 2026

Sources: `packages/core/src/content-mode.js`, `template.js`, `media.js`, `publication.js`; `editor/src/library/preview.js`, `workspace/context.js`; Django `validation.validate_content_mode`, `services.revisions.publish` and `services.globals.publish_section`.

Keeping branding preserves the destination theme. Template colors are an explicit alternative that keeps global font families. Setup imports only validated brand kits and disables absent imports. Invalid choices preserve wizard state and focus an error. Context/mode choices do not snapshot operational records.

Fixed pages have authored bodies; shared header/footer remains independently connected. Live sections/fields automatically enable live mode in one undoable edit. Requesting fixed mode with connections is rejected; page controls describe the correction and retain their actual value. Saved legacy drafts can be recovered/exported, but inconsistent fixed/live content cannot be published. Server validation inspects resolved shared sources; shared-source publication rolls back if it would make an existing fixed page contradictory. Existing tenant/version/publication checks remain authoritative.

Large template previews are separate native protected dialogs, with actual 1280/768/390px layout widths, Fit/100% scaling, keyboard focus and native scrolling. Thumbnail overviews remain inert. Large previews render review HTML and cannot submit invitations or navigate external destinations. Closing or disposing the parent releases iframe resources, resize listeners and observers, and restores reachable trigger focus.

Empty images, videos and galleries are publication warnings with element-selection recovery, not mandatory-image blockers. Missing referenced assets remain blockers. Repeater item prototypes and independently managed shared sources do not receive false local empty-slot warnings. The Media workspace lists locally editable empty slots. Automated coverage: `tests/template-workflow.test.mjs` and `python/website_builder/tests/test_content_mode.py`.
