# Studio accounts and platform workspaces

Open `http://localhost:4173/studio` after running `npm run dev` from this repository. Studio starts at its dashboard; `/studio/builder`, `/studio/components`, `/studio/settings` and `/studio/analytics` share one authenticated account. First-owner enrollment remains local-only. Existing account passwords are unchanged.

Studio uses its own `studio_sessionid` and `studio_csrftoken` cookies. Sign in once after this update: old default-name cookies are deliberately not treated as Studio authentication. The seven-day server session persists across reloads and navigation. Sign out of Studio ends that session and clears Studio recovery copies; it does not sign out other platforms and suppresses immediate automatic reconnection.

## PixelCore integration

Start PixelCore using its root `npm run dev` command. Its default frontend/API ports are 3001/8000; Studio uses 4173/4174 with component previews on 4175. No Docker service is needed. For an already signed-in configured platform, Studio's login page attempts an automatic connection. Multiple editable businesses produce a business chooser. Connect PixelCore supports a user-opened connection window when browser cookie/framing restrictions prevent the silent connection. Sign in to PixelCore opens its normal account page when needed.

For sibling local checkouts, Studio generates a private `.data/platform-client.key` file on first startup, mode 0600. PixelCore development settings read it when available. Restart an already running PixelCore backend once after the file is first created. This development credential is not committed, is not an account password and must not be pasted into documentation or frontend environment variables.

Explicit environment configuration:

| Setting                                      | Application        | Purpose                                                               |
| -------------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| `STUDIO_CLIENT_SECRET`                       | Both backends      | Same confidential credential from the deployment secret store         |
| `STUDIO_PIXELCORE_FRONTEND_ORIGIN`           | Studio             | Exact PixelCore browser origin; local default `http://localhost:3001` |
| `STUDIO_PIXELCORE_API_ORIGIN`                | Studio             | Fixed API origin; local default `http://localhost:8000`               |
| `STUDIO_FRONTEND_ORIGIN`                     | PixelCore backend  | Exact accepted Studio audience; default `http://localhost:4173`       |
| `NUXT_PUBLIC_STUDIO_ORIGIN`                  | PixelCore frontend | Exact accepted parent/opener origin; default `http://localhost:4173`  |
| `WEBSITE_BUILDER_FRONTEND_URL`               | Studio backend     | Public browser origin; local runner sets this from `PORT`             |
| `STUDIO_DEBUG=false`, `STUDIO_ALLOWED_HOSTS` | Studio             | Disable local exceptions and supply deployed hostnames                |

Deployed origins must use HTTPS. Use the same hostname consistently: `localhost` and `127.0.0.1` are different origins. Do not broaden an origin to `*`. Environments that disallow embedded pages can retain the explicit connection-window flow. A failed platform connection never loads sample data as a fallback.

The host issues a 60-second one-use code, bound to state and exact audience. Confidential server exchange establishes a revocable business-scoped grant held only by Studio's server. Every gateway operation rechecks the host user and current owner/admin/manager membership. Websites, media, revisions, templates, shared sections, live bindings, publication and review links remain in PixelCore. Studio never receives a platform refresh token. Identity mapping uses issuer/subject, never matching emails, and does not grant component administration.

Both applications have additive migrations. Their native runners apply migrations before starting. Run the corresponding migration commands during deployment.

## Profile and account settings

Local Studio users can update display name/email, replace/remove their avatar and change their password with current-password verification. Password changes preserve the current session. Avatars accept still JPEG/PNG/WebP under 2 MB and up to 4096×4096 pixels; the server creates a 256×256 WebP rendition and strips metadata. Missing images use initials without an external service.

Platform users see their host identity and account-settings link. Their profile remains owned by the host; Studio does not save a conflicting local identity. Appearance is the existing persistent light/dark preference and does not modify website branding.

## Analytics setup

Select a saved website and Google Analytics or Plausible, enter its public domain and structured provider configuration, then Save configuration. This creates a draft revision. Publish configuration publishes the current saved website draft, including layout, through its normal owning-host callback and version checks.

The guide distinguishes Not configured, Draft configuration, Published—verification needed and User-confirmed verification. Opening links never verifies anything. Confirmation records the user's observation against the published configuration fingerprint; changes invalidate it. Real reports stay in the provider. There are no report-reading credentials or fabricated metrics.

Tracking stays off without affirmative host consent. Native published clients call `enhanceAnalytics(element, publishedDocument.analytics, {consent:true,mode:'public'})`; React/Vue `WebsitePage` accepts `analyticsConsent`, default false. Pass the actual host consent decision. Studio/editor/review never activates analytics. PixelCore public builder pages now supply the explicit business/provider preference; other hosts must supply their own integration, which the guide identifies when unavailable.

The optional enhancer validates provider/domain, requires the configured hostname, deduplicates scripts and disables its tracking when disposed. Google uses a structured tag ID. Plausible uses the site's HTTPS `plausible.io/js/` URL and manual pageviews, with optional enhanced measurements disabled. Reporting ingestion, synthetic performance scores, A/B tests and eye tracking are not presented as implemented.

Official guides: [Google Analytics setup](https://support.google.com/analytics/answer/14183469?hl=en), [Google consent integration](https://developers.google.com/tag-platform/security/guides/consent), [Plausible installation](https://plausible.io/docs/plausible-script), [Plausible manual measurements](https://plausible.io/docs/script-extensions).

## Discovery, reviews and analytics consent update

Overview and source selection now search/filter on the server and page through all authorized records. Website rows offer Edit plus More → Analytics/View live. Share in the builder opens Review center for link lifetime/access, revocation and open/resolved discussions. Publish opens Review & publish, including current-versus-live summary and actionable readiness findings.

PixelCore public builder pages now integrate the renderer's consent input. Visitors choose Allow analytics or Decline, and can change the choice from the same page. The preference is scoped to business/provider and expires after 180 days; storage failures keep the choice only for the page session. Tracking remains off by default, on invitation RSVP routes, in workspace/Studio/review routes, without a matching published domain, and in standalone sample previews. PixelCore advertises consent integration availability; standalone Studio still reports that a host integration is required. Verification remains an explicit user confirmation, and traffic reports remain in the configured provider.

Existing credentials and session cookies are unchanged. No database migration is required for this update.
