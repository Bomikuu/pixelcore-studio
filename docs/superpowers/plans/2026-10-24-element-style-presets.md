# Element style presets implementation plan

**Goal:** Choose common appearances through illustrated cards, with detailed controls under Advanced styling.

**Architecture:** A framework-independent core catalog expands a selected preset into validated node styles in one undoable operation. The public renderer understands the resulting styles; Django validates the same bounded values. The existing inspector uses canonical buttons, theme-colored illustrations and a persistent native disclosure.

**Tech stack:** Native JavaScript DOM, shared core/renderer, Django validation, Node tests and Happy DOM.

**Spec:** User request and the existing DESIGN.md / UX-CONTRACT.md. Buttons offer Rounded, Pill, Outline, Outline pill, Soft and Text link. Containers offer Plain, Bordered, Elevated and Filled. Headings, text, images, sections and column layouts receive small relevant groups. Never change content, bindings, links or global font families. Keep responsive overrides; applying a preset changes only its owned style properties on the current breakpoint. Keep visibility, free positioning and unrelated layout intact. Custom changes must not leave a false selected preset.

**Execution:** Native in this session, as previously requested. No agents, builds or browser/visual/manual verification.

- [x] Add `core/style-presets.js`, bounded border/shadow/overflow values and transparent backgrounds, TypeScript declarations and atomic `style-preset` operations. Test validation, preservation, undo, invalid choices and responsive inheritance.
- [x] Render these styles through existing public CSS; ensure transparent backgrounds reset images/gradients and contrast checks use the real ancestor backdrop. Mirror schema validation in Python; test persisted styles and rejected injection.
- [x] Add `editor/inspectors/presets.js` and geometric illustrations. Lead with illustrated choice buttons, explain Custom state, and move detailed responsive/typographic/background/border/motion controls under Advanced styling. Preserve disclosure/focus through edits and selection changes.
- [x] Run scoped automated tests, then the shared suite, type/syntax/format checks, host check:ui and static design audits. Update design/interaction/verification records with actual results.

## Review focus

Inherited background resets, retained phone/tablet overrides, preset changes after custom border edits, one-step undo, private/bound content preservation, keyboard names and hidden advanced controls, disclosure survival across synchronous rerenders, Python/JavaScript schema parity, and public rendering with no editor dependency.
