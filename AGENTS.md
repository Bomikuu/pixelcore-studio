# Website Builder agent guidance

- Always use jev-cli and graphify. Keep Jev state free of secrets and private records; verify its guidance directly.
- Use targeted automated frontend/backend tests and checks. Do not run builds, visual tests, browser visual inspections, or manual verification without explicit user request.
- Keep public renderers independent of editor, review, and optional free-form runtimes.
- components/ui is the canonical editor primitive layer. Feature controls use it.
- Preserve host data and authorization; never expose private business/clinical records through a binding.
- Do not modify protected DineEase source. Do not create public repositories or publish registry releases without a resolved owner/destination.
