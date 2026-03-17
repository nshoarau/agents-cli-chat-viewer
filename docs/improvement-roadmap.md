# Improvement roadmap

This file tracks the next product and engineering improvements for the
conversation viewer so they do not get lost between sessions.

## Planned improvements

- [x] Add parser fixture tests for Gemini, Codex, and Claude session activity.
- [x] Split the detail view into smaller components.
- [x] Render richer diffs for file edits and writes.
- [ ] Add transcript search inside a conversation.
- [ ] Virtualize the detail panel for very large sessions.
- [ ] Improve activity attribution to assistant turns with stronger ids when
  logs expose them.
- [ ] Add collapsible sub-groups inside activity panels.
- [ ] Add better empty-state messaging for activity panels.
- [ ] Persist conversation detail UI preferences in local storage.
- [ ] Add export options for conversation and activity data.
- [ ] Add clickable file-path actions that either open the default IDE or show
  a file viewer modal.

## Current sequence

The implementation order is:

1. Add parser fixture tests.
2. Split the detail view into smaller components.
3. Render richer diffs for file edits and writes.
4. Add transcript search inside a conversation.
5. Pause for verification.
6. Continue with the next item after review.
