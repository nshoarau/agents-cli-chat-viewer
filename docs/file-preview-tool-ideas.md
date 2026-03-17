# File Preview Tool Ideas

## Reliability

- Show a clearer inline failure reason for preview errors: not referenced in conversation, outside allowed paths, binary file, too large, or unreadable encoding.
- Detect binary files before rendering and switch to a dedicated non-text preview state.
- Add a raw download or open-raw fallback when preview rendering is not possible.

## Editor Integration

- Add a custom editor URI template in the UI in addition to preset editors.
- Support per-project editor preferences instead of only per-conversation preferences.
- Show the generated editor URL and resolved path in a small debug/details panel when opening fails.

## File Navigation

- Add a dedicated `Files` panel that aggregates all referenced and touched files in the conversation.
- Group files by folder and sort by recency or frequency.
- Mark whether a file came from prompt text, tool activity, or both.
- Add a quick-open action such as `Cmd/Ctrl+P` scoped to files mentioned in the current conversation.

## Preview UX

- Add language badges and optional line numbers in the preview modal.
- Add a `Reveal in conversation` action from the preview modal to jump back to the originating message or activity.
- Keep a small toast or inline confirmation for actions like copy path and failed open-in-editor attempts.

## Testing

- Add end-to-end coverage for file preview, copy path, and editor-link opening flows.
- Add path fixtures for WSL, UNC, dotfiles, extensionless filenames, relative paths, folders, and domain/IP-shaped strings.
- Add backend contract tests for preview payload shape and edge-case authorization behavior.
