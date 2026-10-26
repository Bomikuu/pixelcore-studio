---
version: alpha
name: Website Builder
description: A canvas-first publishing workbench with quiet chrome and direct manipulation.
colors:
  primary: '#3D5AFE'
  primaryHover: '#536DFE'
  onPrimary: '#FFFFFF'
  background: '#101112'
  surface: '#18191B'
  input: '#141517'
  text: '#F1F2F3'
  muted: '#A0A3AA'
  border: '#33363B'
  controlBorder: '#626873'
  overlay: '#000000'
  danger: '#FF9F9F'
  warning: '#E3C78C'
  focus: '#8DA6FF'
  selected: '#292C31'
  selection: '#3B4880'
  canvas: '#FFFFFF'
  lightBackground: '#F3F5F8'
  lightSurface: '#FFFFFF'
  lightText: '#1D2433'
  lightMuted: '#566176'
  lightBorder: '#D9DEE8'
  lightControlBorder: '#7C879A'
  lightDanger: '#B42335'
  lightWarning: '#795400'
  lightFocus: '#2448D8'
  lightSelected: '#E9EDFA'
  lightSelection: '#D6DFFF'
  lightPrimaryHover: '#2947DB'
  templateWeddingBackground: '#FBF9F4'
  templateWeddingBorder: '#C8CDBF'
typography:
  publicHeading:
    fontFamily: 'Cormorant Garamond'
  publicRsvpHeading:
    fontSize: '48px'
  body:
    fontFamily: 'Manrope, system-ui, sans-serif'
    fontSize: '13px'
    lineHeight: '1.5'
  micro:
    fontSize: '10px'
  sheetTitle:
    fontSize: '22px'
  libraryTitle:
    fontSize: '24px'
  setupTitle:
    fontSize: '28px'
  caption:
    fontSize: '11px'
  secondary:
    fontSize: '12px'
  compact:
    fontSize: '13px'
  panel:
    fontSize: '15px'
  labHeading:
    fontSize: '32px'
  labStatement:
    fontSize: '36px'
  studioLabel:
    fontSize: '9px'
  brand:
    fontSize: '17px'
  dialog:
    fontSize: '20px'
rounded:
  DEFAULT: '5px'
  small: '4px'
  control: '6px'
  swatch: '3px'
  badge: '4px'
  scrollbar: '8px'
  dialog: '12px'
  presentation: '16px'
spacing:
  panel: '20px'
  control: '8px'
components:
  publicWedding:
    backgroundColor: '{colors.templateWeddingBackground}'
  publicWeddingSeparator:
    backgroundColor: '{colors.templateWeddingBorder}'
  button:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.onPrimary}'
    rounded: '{rounded.DEFAULT}'
  input:
    backgroundColor: '{colors.input}'
    textColor: '{colors.text}'
    rounded: '{rounded.DEFAULT}'
  primaryHover:
    backgroundColor: '{colors.primaryHover}'
  selected:
    backgroundColor: '{colors.selected}'
  selection:
    backgroundColor: '{colors.selection}'
  warning:
    textColor: '{colors.warning}'
  editorSurface:
    backgroundColor: '{colors.surface}'
  secondaryText:
    textColor: '{colors.muted}'
  controlBoundary:
    backgroundColor: '{colors.controlBorder}'
  overlay:
    backgroundColor: '{colors.overlay}'
  boundary:
    backgroundColor: '{colors.border}'
  error:
    textColor: '{colors.danger}'
  focus:
    backgroundColor: '{colors.focus}'
  canvas:
    backgroundColor: '{colors.canvas}'
---

# Website Builder Design System

## Overview

### Creative North Star

The user supplied docs/references/editor-workspace-reference.png and approved its Wix-like workbench structure, then requested a light appearance alongside dark: a publishing workbench where the actual page occupies the center and editing tools stay at the edges. Operate mode; familiarity, legibility and precise selection outrank novelty. Code-first, no comp generation or browser inspection under the user's current verification policy.

### Product context and register

Desktop business owners editing sites frequently; responsive public pages. Initial English UI with host locale for data. No Japan-market claim. Existing product plan and audit are the business sources. No invented metrics or testimonials.

## Colors

Light is the default workspace appearance: cool near-white canvas surroundings, white tool panels, slate text and blue action/selection. The optional dark appearance preserves the near-black workspace and graphite panels. Both share quiet rules and the same action family. White canvas and public site palettes remain independent of the workspace. Errors use text plus the warm danger token. Canonical runtime source is packages/editor/src/tokens.js, mirrored here. Global site palettes belong to the website document, never editor chrome.

## Typography

Self-hosted OFL Manrope for the workspace and public body; Cormorant Garamond for wedding display typography. Compact 12–13px controls, 11px contextual labels and 10px supporting metadata. Library headings 24px, setup headings 28px. Source TTFs and OFL notices live with renderer assets; no third-party font requests.

## Layout

58px top command bar; 48px tool rail, 240px Pages/Layers panel, flexible canvas, and 280px inspector. Below 1200px shrink side panels; below 950px alternate left/right panels; below 650px show one canvas or tool/property sheet. The editor owns its scroll areas. Full-screen libraries on phones. Primary publication, preview and history access remain reachable. Canvas zoom is an editor transform, not a content font-size change.

## Elevation & Depth

One restrained shadow around the page only. Toolbar and panels use borders and tonal separation. Popovers remain above the editor and below modal dialogs.

## Shapes

Five/six-pixel controls, square canvas, quiet one-pixel rules; eight-pixel library cards and twelve-pixel dialogs. Selected nodes have a blue outline. No ornamental icon tiles.

## Components

All controls come from packages/editor/src/components/ui/index.js. Native select and color controls deliberately retain operating-system popup ownership. Modal dialogs use native dialog plus managed focus/Escape. Separate Template and Add libraries use actual renderer previews, category/search controls and responsive detail previews. The Template dialog groups Built-in and My templates, with Add template and Import JSON actions in its header. Creation/import uses a labeled inline detail form with preview, persistent validation and retry; it does not stack another dialog. Eight cards load per batch. The three-step context setup pre-fills known source information. Brand import remains preview/apply/cancel. Primary (headings) and secondary (body) families are website-wide settings in Theme & branding. Selected elements display their assigned font without a family override. Templates use the destination font pair. Reversible element removal offers Undo rather than a blocking confirmation.

### Foundational visual states

Hover, focus-visible, pressed, disabled, busy, selected, saving/saved, conflict, offline, and error have text/semantics. Status region is persistent. Empty canvas offers Add section.

### Motion

Editor transitions answer an action. Content animation is opt-in, reduced-motion aware and never hides content by default. No editor or drag dependency is shipped in public page entry points.

### Content and data visualization

Use real host records. Standalone sample records are labeled as examples. Connected fields show their source and cannot silently overwrite operational data.

## Do's and Don'ts

- Do show the page at useful scale with persistent selection.
- Do keep role tokens and actual renderer output shared across frameworks.
- Don't replace the canvas with settings-only forms.
- Don't present a color calculation as full accessibility certification.

### Data, history and shared editing

The existing dark workbench now exposes Data and Shared sections on its tool rail, with History and conditional Recover actions on the toolbar. Keep these as task-oriented, labeled controls using the same native UI factory. Data fields are explicit and typed; no technical query editor. Responsive property groups show inherited origin and a compact Reset action. Draft/live history uses two wrapping preview columns and a short structural summary. Shared-section editing opens one protected-focus editor and distinguishes saving a source draft from publication. Recovery and publication failures remain visible and retryable. No palette or typography-world changes accompany these features; the site-wide two-family policy remains authoritative.

### Library, metadata and media additions

Manage saved designs is one native dialog, with an active/archive filter, a compact design list and adjacent details/version actions. Deletion confirms inline; errors retain the action context. Search & sharing remains in the page inspector with a plain metadata preview and actionable page checks. Your media owns one upload workflow, search and explicit missing-reference replacements; gallery controls choose images by their descriptions rather than requiring IDs. These additions keep the existing palette, spacing, global typography and primitive ownership. FAQ uses native disclosure; enhanced tabs use the site palette and keyboard focus, with all text readable without enhancement.

### Appearance and interaction focus

`packages/editor/src/tokens.js` owns light/dark chrome roles; the editor host applies one pair of token sets to panels, controls, dialogs and tooltips. Native color-scheme follows the appearance. Website palettes and global font pairs remain document settings. The sun/moon rail action persists only `light` or `dark` in `sitebuilder:appearance:v1`; it works without storage. Host options may choose an initial appearance.

Use one small SVG for primary commands (save, preview, share, publish, export), library creation/import, and selection actions. Keep filters, text lists and routine field resets text-only. Sidebar help uses one custom fixed tooltip owner with hover delay, immediate keyboard focus, descriptive ARIA, Escape, pointer access to the tooltip and viewport bounds. Browser title tooltips are reserved for document/iframe titles.

Layer/canvas selection highlights the element, opens its inspector, expands the layer path, clears an incompatible layer filter, and reveals/focuses the target. Mobile selection opens/focuses the inspector heading; explicit Edit properties focuses its first control. Inline text/IME retains ownership of focus. Committed inspector edits preserve the active field, caret and scroll. Duplicate selects its new copy; boundary moves and invalid collection-card operations are disabled. Preview runs tabs/disclosures/video controls and safe links; external links open separately and native RSVP remains an authorized live-host action. Structural elements never become contenteditable through Enter.

### Spacious tool workspaces

Theme & branding, Media, Shared sections and Connected data use `workspace/tools-dialog.js`: one native modal up to 1240px wide, with a clear header, Close action and horizontal tool navigation. The dialog fills the viewport on phones, owns its body scroll and inherits the active editor appearance. Pages/Layers and the element inspector retain their canvas-side roles. Page settings opens Theme & branding rather than duplicating global theme controls in the sidebar.

Branding uses a two-column controls/current-draft preview layout; palettes, global font pair and color fields stay together. Preview and controls refresh without closing the modal. The Media workspace uses a responsive thumbnail card grid with an Add media card at the end. A selected card opens image/video details and an explicit Add to page or Replace selected media action. Add media opens a file/alt/upload composer within the same workspace. Search/type filters, bounded 24-card batches and Show more keep the library manageable. Selection returns focus to the canvas. Upload progress, selected file, errors and retry survive tool switches; a completed upload refreshes the project library even after closing the workspace. Shared/Data keep their existing tenant and publication contracts.

## Product identity

The editor uses the supplied Pixelcore character icon beside a live-text “Pixelcore” / “Studio” wordmark. Use Manrope 800 with theme-aware text and blue accent tokens; keep the lettering as selectable text. The 38px icon has explicit dimensions and ships inside the editor package. Workspace and page names remain separate context, hidden below 950px to preserve toolbar room. This product identity belongs to editor chrome, independently of the website’s own branding. The standalone browser tab uses the same icon.

## Element style choices

The contextual inspector leads with illustrated, two-column preset choices: six button appearances; four container/card treatments; three each for headings, text, image frames, section colors and column layouts. Thumbnails use the current website palette and font pair, with decorative geometry inside named canonical buttons. Selected state uses the existing focus color and `aria-pressed`; custom changes clear the selected appearance when its owned properties differ. No new UI font, icon library or editor dependency enters public rendering.

Content and link controls remain directly available. Detailed responsive layout, shape/border/shadow, typography, background and motion controls live under a collapsed native Advanced styling disclosure, retaining its open state and focus through edits. Presets are ordinary theme-role styles, applied in one undoable operation to the current breakpoint. Existing screen overrides, content, bindings and unrelated layout remain intact. Image frame controls clip rounded corners; border width supplies a visible border style automatically. The native disclosure is a focus destination when there are no visible basic controls.

## Studio dashboard and account shell

Dashboard routes have one 64px account header, one 224px labeled sidebar (208px below 1100px) and flexible content. Below 800px the sidebar opens through a named menu button with Escape and outside-click dismissal; below 650px content stacks. Once mounted, the builder owns its sole header and editing navigation: the outer Studio header/sidebar are removed and the account menu occupies an editor header slot. Component Lab retains Studio navigation and removes its embedded header. Reuse existing tokens and Manrope: 28px page headings, 20px sections, compact 12px content/controls and 11px metadata. No new palette, font or icon dependency.

The account disclosure contains real/fallback avatars, identity source, settings and scoped Studio sign-out. Overview begins with four real summary tiles: Websites, Published, Unpublished changes and Latest activity. Tenant-wide aggregates remain accurate beyond the displayed row limit. All/Published/Unpublished filters preserve their selection in the URL; rows distinguish unpublished updates from published revisions. Analytics setup replaces fabricated charts. Native Studio forms use source-owned Shadcn input recipes through the shared UI layer, with focus/invalid/disabled states and a named icon-only password action inside the input. This is a native DOM port, without a Vue/React runtime. Forms retain errors, duplicate guards, input preservation and unload/sign-out protection. Platform records remain in their owning business. Visual/browser acceptance has not been performed under the automated-only verification policy.

### Component Lab layout

The standalone `/studio/components` surface extends the same light/dark Pixelcore Studio identity: supplied character icon, compact 17px/9px live wordmark, Manrope, blue action/focus tokens and quiet neutral surfaces. A 76px Studio navigation bar leads to a spacious library with real uploaded poster cards and bounded batches. The empty state pairs an import area with a real downloadable Three.js starter. Access setup and sign-in use the same canonical labeled fields and buttons.

The component workspace gives the responsive preview most of the screen and a 340px settings/details/version panel. The preview scales actual desktop/tablet/phone frame widths to fit its available area, supports theme/motion/restart and reports runtime errors with fallback content. Under 800px, configuration follows the preview in one column; library cards collapse from three/four to two to one. No imported code executes in library thumbnails or the authenticated editor DOM. The importer/admin app lives outside installed packages.

### Complete Studio workflows

Website discovery uses labeled search, sorting and server publication filters, with 25-row pages and retained URL state. Compact thumbnails illustrate the saved section structure and actual page background; they are not screenshots. Edit stays primary, with analytics/live links in a native More disclosure. Summary tiles link to the corresponding filter without changing their full-tenant totals.

Share opens the native Review center: creation/access/lifetime controls, a paged link list and adjacent owner discussion/settings. Open/resolved filters, explicit revocation and element/recorded-width navigation reuse existing permissions. Secret URLs are shown only when created. Review & publish combines blockers/warnings, live structural comparison, host global impact and element navigation in one modal, preserving failed confirmation for retry. These surfaces use existing tokens, canonical controls, responsive single-column layouts and named feedback.

Connected data reports the time of the last successful refresh and retains its previous data on failure. Refresh never edits the website or discovers new private fields. Template packs filter by context and explain required features/fields, fallback states and native RSVP ownership. Saved design lists fetch summaries first and content on selection. Canvas edits patch keyed renderer output, preserving unchanged media nodes; selection still uses the existing focus/reveal contract. Minimum editor height no longer exceeds the containing viewport; coarse-pointer controls receive larger targets.

The font registry distinguishes bundled, system and unavailable legacy families. New choices offer supported families; an unavailable selected legacy value remains visible and disabled until replaced. Installed hosts import the renderer's self-hosted `fonts.css` once, including SSR. The two-family global policy remains unchanged.

### Loading and recovery screens

Studio startup, builder opening, analytics setup and Component Lab use a centered CSS ring spinner above a short actual-stage title and explanation. Animation rotates a simple ring without WebGL, fake percentages or simulated progress. Reduced motion keeps the spinner static; full-screen loading reads the saved workspace appearance. The initial HTML includes the same loading markup before application modules start.

Page failures distinguish session expiry, permissions, missing routes and connectivity/service failures. A local decorative browser/cube SVG introduces the screen, followed by a focused heading, concrete recovery actions and optional plain-text error details. Missing artwork falls back to a static ring. Retry guards duplicate requests and puts loading inside the existing shadow root. Form/action errors retain their current context; a page-level failure does not replace unsaved forms. Tokens, type, canonical controls and responsive spacing remain shared.

### Complete premade websites

The six premade templates in `packages/renderer/src/premade.js` compose full header/content/footer documents; `library.js` owns discovery and `render.js`/`widgets.js` own shared rendering. Reuse core named palettes and global heading/body families. Storefront editorial uses a split image opening and current collection; compact uses the Ocean palette and three featured products. Wedding editorial uses the existing invitation palette and Cormorant Garamond; Garden uses Forest and a split RSVP. Landing minimal has a split opening, while image-led uses an approved full-width photograph with a dark overlay. With no approved hero, it falls back to the split layout. Page sections use 80/48/28px desktop/tablet/phone padding; columns stack on phones. No new dependencies or animation runtime.

Template details show a readable section outline. Header/footer links use supplied host routes or real section anchors. Footer social profiles have text labels and safe external destinations, with email/phone actions and no fabricated accounts. Wedding footer retains its centered sign-off with contact/social links. Template replacement preserves the destination’s global fonts, context, identity, undo, and host frame ownership. Public action text uses the onPrimary token even under the shared anchor rule.

### Template workflow corrections

Template setup and the library use `core/template.js` for explicit branding provenance: keep the destination theme, use template colors with the destination’s global fonts, or import a validated connected kit in setup. Keep is the default and never silently replaces the palette. Missing import capabilities are explained; invalid kits retain the wizard and focus an inline error.

The library’s small illustration is a layout overview. Its Open full-page preview action opens `editor/src/library/preview.js`, a separate protected native dialog with restrained chrome, Desktop/Tablet/Phone controls and Fit/100% zoom. Device sizes are actual 1280/768/390px iframe viewports; scaling happens outside their layout. The page owns native scrolling and keyboard focus; links and private submissions remain inert under an opaque script-free sandbox. Closing removes the frame and observers and returns focus to the trigger; closing the parent library also disposes the preview. No animation dependency is added.

`core/content-mode.js` distinguishes authored bodies from connected sections. Shared header/footer is exempt; actual linked section content is checked. A live connection updates mode as part of the same history entry. Explicitly requesting fixed content with remaining connections is rejected without replacing the draft. Empty-media warnings select the original element; missing references remain blockers. Existing tokens, controls, light/dark appearance and the two-font policy are retained.
