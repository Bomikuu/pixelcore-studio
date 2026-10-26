# Host adapter contract

## Editor

Provide a validated `WebsiteDocument`, an initial optimistic `version`, and a public-safe `data` envelope. `adapter.saveDraft(document, expectedVersion)` returns `{ version }`; throw an error with `code: 'CONFLICT'` on a stale version and preserve the user's pending draft. `publish(expectedVersion)` changes only the selected publication. `createReview(document, expectedVersion)` creates a snapshot of the saved revision and returns `{ url }`.

Optional `capabilities`, `sources`, `getBrandKit()`, `openSource(binding)`, and `loadData()` drive available widgets and source navigation. A binding is `{ source, path }`, never an arbitrary query or URL. The host resolves only registered, permitted fields. Fixed-copy overrides require explicit user action and never update the underlying record.

`WebsitePage` adapters use exactly `renderPage` output. The editor's iframe uses the same renderer: editing selects elements; Preview enables native content interaction and safe link navigation in separate tabs. Operational guest widgets are not mounted inside the editor. CSS and user text are validated/escaped; the document does not accept executable HTML, scripts, arbitrary CSS, or executable URLs. Assets are host-approved IDs/URLs. Site layout/theme overrides do not mutate global host branding.

For Nuxt linked development packages, deduplicate `vue` and allow the sibling package directory in the dev server's filesystem policy. For Next, keep the adapter and peer React runtime consistent with the host; use `@sitebuilder/react/server` for server-only public HTML and load the editor only in its client workspace.

## Django

Install `python/website_builder` as `shared-website-builder`, or add its `python` directory to the host's import path. Add `website_builder` to `INSTALLED_APPS`, include `website_builder.urls` under `/api/website-builder/`, and apply its additive migrations using the host's normal migration command.

Required hooks (callables or dotted imports):

- `WEBSITE_BUILDER_AUTHORIZE(request, website, action)`: authenticate and authorize this tenant/site. Actions: edit, publish, review, resolve. Default is deny. Never accept the incoming tenant ID as proof of membership.
- `WEBSITE_BUILDER_RESOLVE_DATA(request, website, review=False)`: resolve only public-safe identity/catalog/event/media fields. For review, limit assets and data to the saved document's references; do not copy an operational database into a snapshot.
- `WEBSITE_BUILDER_REVIEW_DATA(request, share)`: recheck tenant/source access and media withdrawal on every guest read/write. Return the saved data snapshot, or deny access. Do not replace it with newer data silently.

Optional hooks: `WEBSITE_BUILDER_CAPABILITIES(request, website)` and `WEBSITE_BUILDER_AFTER_PUBLISH(request, website)`. The publication callback runs in the same transaction as publication.

Configure `WEBSITE_BUILDER_FRONTEND_URL` and optionally `WEBSITE_BUILDER_REVIEW_PATH` (default `/website-review`). The HTTP client uses Django CSRF cookies and credentialed same-site/cross-port requests. A custom host `request` callback may adapt its existing JWT or session client; failures normalize to the builder's error codes. Do not expose private-record fields to public widgets or review guests.

## Review

`mountReview(element, { baseUrl })` exchanges the initial fragment secret via POST. It stores no secret in persistent browser storage. The URL then retains only a non-secret review ID; independent HttpOnly capability cookies support multiple review tabs. Every subsequent operation rechecks expiration, revocation, and host policy.

Threads belong to a specific share/revision. Anchors store element identity, optional field identity, normalized coordinates, and viewport width. Moves keep node identities; duplicated elements receive fresh IDs. Guest names are self-entered, not authenticated identities. Guests cannot edit/publish a site, resolve threads, or invoke checkout, booking, or RSVP operations.

Cookies currently assume the documented `/api/website-builder/reviews/` mount path. A differently mounted API must adjust cookie scoping deliberately rather than silently broadening it.

## Live versus fixed

Both use one schema. The published composition and fixed text stay stable. Live bindings resolve current approved data on page requests or through explicit per-widget refresh. Realtime subscriptions are optional. Review snapshots freeze resolved data while preserving current authorization/withdrawal checks.

## Workspace, regions and widgets

`adapter.workspace` identifies the source/purpose and actual host page list. `openPage`, `openRegion`, `changeSource` and `exit` use host navigation; keep unsaved-route protection active. Enable `showSetup` on the Vue/React editor when using the first-run context flow. Page identity and source remain stable when applying a template.

A host `data.frame` has owner `host`, an optional layout revision ID, and validated header/footer region nodes. Editor/review render the frozen frame representation; public hosted content omits those regions because the host renders its actual navigation/cart/footer components. Pass `landmark: false` when the host already supplies a main landmark. PixelCore stores the global frame as a separate Website/revision stream keyed `layout:<site ID>` and publishes it separately. General headers in standalone/wedding documents render normally.

`renderPage` returns widget descriptors in addition to HTML. Public Vue/React `WebsitePage` accepts a `widgets` registry mapping a registered ID to `(element, {nodeId}) => dispose | void`. The host supplies authenticated context separately and mounts its own component into that marker; dispose on replacement/unmount. Only registered, validated presentation props enter a document. PixelCore uses `pixelcore.event-rsvp`; guest identity, invitation token and endpoint remain private host state. Editor and review entry points never call public widget mounters. React exposes this contract but Medframe remains unmodified.

`listSections()` and `saveSection(name,node)` use `/sites/:id/sections/`. The API requires management access, scopes saved sections to the website's tenant, validates the copied section, and caps the library at 100. Insertions clone identities and re-evaluate capability requirements. Saved copies are independent.

## Global typography and template storage

`theme.headingFont` is the primary family, and `theme.bodyFont` the secondary family. Font families belong to the website theme. New style operations reject `fontFamily`; legacy document values remain readable but the renderer ignores them. `normalizeGlobalFonts` returns a validated copy without desktop or responsive family overrides. Draft saves perform the equivalent normalization on the server, without rewriting immutable revisions. Host widgets must inherit these roles; PixelCore’s embedded RSVP aliases its font variables to the builder pair.

`listTemplates(): Promise<SavedTemplate[]>` and `saveTemplate(name, document, description?): Promise<SavedTemplate>` use the existing authenticated transport at `/sites/:id/templates/`. `SavedTemplate` contains `id`, `name`, optional `description`, and a validated `document`. POST returns `{template, templates}`; GET returns `{templates}`. Apply migration `0003_savedtemplate`. Management authorization, CSRF and tenant scope match saved sections; the server caps each tenant’s library at 100 entries. Template creation does not create a page revision or change its publication.

Core exports `createTemplate`, `parseTemplateJSON`, and `templateDocument`. The portable format is version 1 with `name`, optional `description`, and `document`; raw exported website JSON is also accepted. Source context is discarded, unknown root/node/theme fields are rejected, global typography is normalized, and connected data is never bundled. No script evaluation or raw HTML import exists. Import does not upload assets; the host resolves only existing approved IDs. Capability requirements are inferred again for saved/imported layouts before applying. The editor retains destination identity/context/global font pair and leaves host-owned regions in place.

## Recovery and revision history

`website_payload` adds `capabilities.workspace.recoveryScope`, a stable hash scoped to the authenticated user, tenant and website. Pass the workspace through `createDjangoAdapter`; custom hosts can provide `adapter.recoveryScope`. Recovery is disabled without a scope. Only validated document content is retained in browser storage; resolved data and private invitation state are excluded. Hosts ending a session dispatch `sitebuilder:session-ended` before calling core `clearRecoveryCopies(localStorage)`. This clears only builder-prefixed recovery keys, stops active editors and prevents late saves from recreating copies. PixelCore wires this into its existing logout path.

The adapter supports `listRevisions()`, `readRevision(id)` and `restoreRevision(id, expectedVersion)`. GET `/sites/:id/revisions/` returns `{revisions:[{id,number,createdAt,isDraft,isPublished,title}]}`; GET `/sites/:id/revisions/:revisionId/` returns `{revision:{...metadata,document}}`; POST the corresponding `/restore/` with `expectedVersion` returns a new website payload. Permission and website scope are checked on every operation. A restore appends a draft revision and preserves the live pointer and original revisions.

## Typed public fields and repeaters

Provide `adapter.dataSources` as `{id,label,kind:'record'|'collection',fields:[{path,label,type:'text'|'currency'|'date'|'url'|'asset'}]}` entries. PixelCore supplies real identity/catalog/event fields; the standalone adapter supplies labeled samples. Fields are described explicitly rather than discovered from arbitrary runtime objects. The host still resolves and authorizes the envelope.

Text, image asset ID, link destination and alt text accept `{source,path,format?}` bindings. Format is `text`, `currency` or `date`; currency/locale and optional time zone come from the public envelope. Connected scalar values require explicit detach before overwriting. Source and field paths reject prototype traversal and reserved private-record sources.

A `repeater` contains exactly one card template (`container`, `columns` or `section`); row fields use `source:'item'`. Props include `source`, `limit` (1–50), `offset` (0–10000), `sortField`, `sortDirection`, `filterField`, `filterValue` and `emptyText`. Optional `data.collectionStates[source].status` is `loading` or `error`. Rendering reads only the supplied collection, filters/sorts without mutating it, and applies a bounded page window. It does not fetch arbitrary URLs or replace host catalog pagination. Cards cannot contain host widgets, linked sections, headers/footers or nested repeaters. Expanded rendering is bounded to 3000 nodes; saved/expanded documents retain the 500-element limit where applicable. Bound assets are restricted to IDs present in approved records.

## Linked global sections

Adapter methods: `listGlobalSections()`, `createGlobalSection(name,node)`, `readGlobalSection(id)`, `saveGlobalSection(id,{name,node,expectedVersion})`, `publishGlobalSection(id,expectedVersion)`. These use `/sites/:id/globals/`, `/sites/:id/globals/:sectionId/` and its `/publish/` endpoint. List returns `{sections}`, mutations/read return `{section}`. Metadata includes `id,name,version,draftVersion,publishedVersion,node,affectedPages`; node is the latest draft. Publishing requires publish permission; management operations require edit permission. Libraries are tenant-scoped and bounded to 100 sources.

A `global-section` node carries `props.sectionId` and exactly one fallback section. Linked content is locked against local edits or reparenting until detached. Recursive global links are forbidden. Independent immutable global revisions hold draft/published pointers; saving a source never changes live pages. Publication locks affected tenant websites before source rows, validates expanded live pages and host context, and rolls back invalid changes.

Shared `hooks.resolve_data` enriches editor/review snapshots through `services.globals.resolve_global_sections(tenant,document,data,stage='draft')`. Public hosts use `stage='published'` and must serialize `services.globals.public_document(tenant,document)` so unpublished fallback content is absent even from raw public API JSON. PixelCore and the standalone public endpoint implement both. Reviews retain copied source snapshots and revalidate approved assets/public records on access.

Optional `WEBSITE_BUILDER_VALIDATE_GLOBAL_PUBLISH(request,section)` validates host-specific affected-page contexts; PixelCore rejects incompatible event/RSVP content. This hook must not call page publication or publish unrelated page drafts. Missing/private/unpublished links block page publication until the source is published or the link is detached. Expanded page/section size checks apply even without a custom hook.

## Responsive style resolution

`effectiveStyle(node,breakpoint)` resolves desktop → tablet → phone, including padding shorthand/side precedence; `styleOrigin` identifies inherited values. CSS emits tablet rules before phone rules regardless of JSON insertion order. A `reset-style` operation optionally accepts `property` to clear one override; omission resets the selected breakpoint layer. Added numeric styles: padding sides, percentage `width`, pixel `minWidth`; enums: flex direction, wrapping and distribution. Height respects breakpoints. Responsive motion/freeform writing is disabled in the editor; these remain Desktop configuration with responsive normal-flow fallbacks.

## Saved-design lifecycle (priorities 5–8)

`GET sites/:site/templates/` and `sections/` include archived entries and management metadata (`version`, `archived`, `tags`, `updatedAt`). Insertion libraries filter archived entries. Detail `GET .../:id/` returns `design`, with up to 100 recent template revision summaries. `PUT` accepts `expectedVersion` plus name/description/tags/archive; templates additionally accept a validated `document` or `restoreVersion`. Restore appends an immutable version. `DELETE` requires `expectedVersion`, frees capacity and deletes that saved copy/history, preserving website revisions. All routes authorize the current site and scope the target row to its tenant. `GET templates/:id/versions/:number/` returns a portable template body. Existing list responses still contain documents; metadata pagination remains a future performance task.

Custom adapters can implement `readDesign(kind,id)`, `updateDesign(kind,id,value)`, `deleteDesign(kind,id,expectedVersion)` and `readTemplateVersion(id,number)`. The normal Django adapter provides all four.

## Page metadata and media

Document `seo` stores optional `title`, `description`, `socialTitle`, `socialDescription`, `socialImage` (approved asset ID), `canonical` (complete HTTP(S) URL) and `noIndex` (boolean). `pageMetadata` returns values; `pageHead` returns `{title,meta,link}` for a host head manager. The host may force `noIndex:true`; editor/review modes always force it. Optional description/canonical values are fallbacks. No route mutation, arbitrary scripts, JSON-LD imports or domain ownership is implied. Vue/React SSR share body HTML; metadata remains host-owned.

Enable `workspace.mediaUpload:true` only when `WEBSITE_BUILDER_UPLOAD_MEDIA(request,website,prepared,alt)` is configured. Authenticated multipart `POST sites/:id/media/` accepts `file` and `alt` (250 characters). The service validates/re-encodes raster content before invoking the persistence hook. Return `{id,url,alt,type:'image',width,height,renditions:[{url,width}]}`. The hook stores only in the current authorized tenant and cleans up files on persistence failure. Existing generic asset metadata must never authorize arbitrary rendition paths. PixelCore constrains renditions to the uploaded asset's own generated filenames.

Public-safe asset data may include renditions. The renderer checks URL schemes and dimensions before producing `srcset`. Native videos require approved video assets and are never autoplaying content blocks. New `accordion`/`tabs` nodes use 1–20 `{title,body}` plain-text items; tabs get keyboard behavior from `enhancePage`, with readable unenhanced content. Image crop/fit/focal/decorative properties are allowlisted in JS and Python. No external HTML/embed import or submission endpoint is introduced.

## Editor appearance and focus

`mountEditor` and the React/Vue editor adapters accept `appearance?: 'light' | 'dark'` as an initial override. Otherwise the browser's saved `sitebuilder:appearance:v1` value wins, falling back to light. The rail toggle updates editor host tokens, including dialogs and native control color-scheme, and never saves or publishes website data. `applyTokens`/`tokenCss` retain their legacy dark default for independent review integrations; the editor explicitly selects its appearance.

`editor.select(id, {focus?:'canvas'|'inspector'|'none', reveal?:boolean})` returns whether the element exists. Default selection reveals/focuses the canvas target and expands its layer path. Mobile defaults to the inspector heading. Use `focus:'none'` when an active inline/native control must retain focus. Invalid or removed IDs leave the document unchanged. Ordinary inspector edits preserve focus/caret/scroll through rendering. Custom sidebar help is owned by `components/ui/tooltip.js`; primary commands use the canonical button's optional `icon` property.

The optional `enhancePage(root,{media?:boolean,motion?:boolean})` flags let editing enable native content tabs without running automatic video/motion. Public use retains both by default. The editor preview handles anchors within the canvas and opens approved external URLs separately, preserving the editor document. Native RSVP forms/submissions remain absent until the authorized host mounts its widget.

## Modal workspace presentation

Branding, media, shared-source and data adapters keep their existing API contracts. Their UI uses one `openToolsDialog` controller with horizontal tool navigation. Context is refreshed after document/data changes while the dialog preserves relevant focus/scroll and per-tool local state. Page/element navigation remains on the canvas; global typography/color controls live only in the branding workspace.

Media selection is explicit: select a thumbnail, inspect its details, then add/replace. The Add media card reveals an inline upload composer using `uploadMedia(file,alt)`. Search is local to approved host assets; thumbnails render in batches of 24 with Show more. Pending/failed upload state survives switching tools. Successful late uploads merge into the current editor asset catalog without replacing newer resolved data or reopening a closed dialog. Closing/reopening is independent of page draft mutation. Shared-source read completion checks active workspace state before opening its isolated editor.

## Standalone identity and analytics additions

Studio's account/dashboard app remains outside installed packages. Installed transports retain their normal `csrftoken` default; `createJsonClient` / `createDjangoAdapter` may explicitly supply `csrfCookieName` for a different owning host. The standalone proxy uses `studio_csrftoken` and sets `preserveReviewOrigin:true` on platform editors so a guest review stays on its owning platform. A restricted server connection never exports platform refresh/access tokens to Studio browser storage.

`WebsiteDocument.analytics` is optional structured provider configuration. Template export/import strips the source analytics identity; replacing a website template preserves the destination configuration. Native public rendering can call `enhanceAnalytics(root,config,{consent,mode:'public'})`; React/Vue public `WebsitePage` accepts `analyticsConsent`, default false. The host supplies the actual consent result. Review/editor/SSR never activates tracking. Reporting and provider-side verification remain separate from script installation. See `docs/studio-accounts.md` for setup and operational boundaries.

### Component catalog contract

Standalone Studio management remains outside packaged host modules. Hosts opt into the approved read-only catalog through `componentCatalog: {url}` on native/React/Vue editors. Native sections clone into editable nodes; interactive components store a catalog ID, immutable version and bounded JSON settings. The editor loads only declared setting metadata, never uploaded source into its own DOM.

Public React/Vue `WebsitePage` supports the same catalog option and an explicit `componentData` scalar mapping. A native client can call the optional `@sitebuilder/components` enhancer with `catalogUrl`, `publicData`, theme and AbortSignal; dispose/abort on navigation. Each component receives only declared public input names. Do not pass operational guest, patient, encounter or credential data. Review/editor/SSR uses static fallback content. Existing host widgets and RSVP authorization remain in the host. See `docs/component-lab.md` for the manifest, runtime bridge and local service boundaries.

## Paged discovery, owner review and lazy designs

Studio overview accepts `q`, `status=published|drafts`, `sort=updated|oldest|title`, `offset`, `limit` (1–50, default 25). Its `page` has `total`, `offset`, `limit`, `nextOffset`; summary remains full-tenant. PixelCore sources accept `sourceQ`, `sourceKind=page|event|layout|all`, `sourceoffset`, `sourcelimit`, and return `sourcePage`. Query arguments traverse the restricted bridge separately from the resolved route; every operation rechecks the business grant.

`listDesigns(kind,{offset,archived,q})` returns `{designs,nextOffset}` without documents/nodes. It calls the existing template/section endpoint with `summary=1`; full content is fetched by `readDesign` only after selection. Existing full-list methods remain compatible for older adapters. Names, descriptions and tags are searchable. Archived and tenant restrictions apply before paging.

Optional review adapter methods are `listReviews(offset)`, `readReview(id)`, `updateReview(id,{expectedExpiresAt,canComment,lifetimeDays})`, `revokeReview(id)`, and `resolveReviewThread(id,threadId,resolved)`. `createReview(document,expectedVersion,{canComment,lifetimeDays})` defaults to comments/seven days. Authenticated owner list/detail operations are under `sites/<website>/reviews/`; the guest exchange/session endpoints remain separate. Management responses never expose a stored secret or secret hash. Owner metadata remains inspectable after expiry; guest access remains expiry/revocation gated.

`workspace.publicUrl` can supply the live destination; PixelCore supplies an absolute host URL. Event workspaces can expose `rsvpState=invitation-required|disabled`. Disabled RSVP blocks the editor's readiness confirmation; the host continues to validate authoritative event settings. `loadData()` returns only approved runtime values and supports the editor's explicit refresh action.

Installed frontends should import `@sitebuilder/renderer/fonts.css` once for self-hosted font delivery including SSR. The optional global font registry identifies bundled versus device-provided fonts and legacy unavailable names. React remains ready to install this stylesheet; Medframe is not activated by this change.
