# Improvement roadmap

This file tracks the next product and engineering improvements for the
conversation viewer. Keep it aligned with the current shipped UI.

## Shipped recently

- [x] Parser fixture tests for Gemini, Codex, and Claude session activity
- [x] Split detail view into smaller components
- [x] Richer diff rendering for file edits and writes
- [x] Transcript search inside a conversation
- [x] Virtualized detail panel for large sessions
- [x] Persist conversation detail UI preferences in local storage
- [x] Export conversation data as JSON, Markdown, and activity summaries
- [x] Clickable file-path actions with file preview and editor integration
- [x] First-run onboarding with suggested watch-folder sources and empty-state CTA

## Next priorities

- [ ] Add a simple setup script and `.env.example` for faster local install
- [ ] Show backend/index health in the UI: watched folders, indexed files, last refresh
- [ ] Improve empty states for conversation list, activity panels, and file panels
- [ ] Add keyboard shortcuts for search, prompt navigation, and transcript focus mode
- [ ] Tighten activity attribution to assistant turns when logs expose stable ids
- [ ] Add collapsible sub-groups inside activity panels
- [ ] Add lightweight screenshots/GIFs to the README for the main flows
- [ ] Package the app with an easier single-command local startup story

## Current sequence

1. Improve onboarding and empty-state UX.
2. Reduce setup friction with scripts and config templates.
3. Add diagnostics so users understand watcher/index state.
4. Improve power-user navigation with keyboard shortcuts.
5. Tighten activity grouping and attribution quality.
