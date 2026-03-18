# agents-cli-chat-viewer

A local dashboard for browsing CLI agent conversations from Codex, Claude, and Gemini.

## For Users

### 1. Install

```bash
npm install
```

### 2. Start the app

```bash
npm start
```

This production command:

- builds the frontend and backend
- starts a single Express server
- serves the UI and API from the same port
- uses user-local config and data directories instead of writing runtime state into the repo

Default URL:

- App: `http://localhost:3000`

### Optional Docker path

If you prefer containers:

```bash
docker compose up --build
```

This starts the app on `http://localhost:3000` with persistent Docker volumes for config and data.

If you want the onboarding wizard to auto-detect agent folders from the host, use `docker-compose.sources.yml.example` as a starting point and mount the host paths you care about.

### 3. First run in the UI

1. Open `Watched Folders`
2. Enable any suggested Claude, Codex, or Gemini source with one click
3. Or expand `Custom Path` and add an absolute folder/file path manually
4. The app will rebuild the index and show matching conversations

### Runtime directories

By default, runtime state is stored outside the repo:

- Config: `~/.config/agents-cli-chat-viewer`
- Data: `~/.local/share/agents-cli-chat-viewer`
- Logs mirror/index input: `~/.local/share/agents-cli-chat-viewer/logs`

You can override these with environment variables in `backend/.env`:

- `PORT`
- `LOGS_DIR`
- `WATCH_FOLDERS_CONFIG`
- `CONVERSATION_INDEX_CACHE`
- `AGENTS_CLI_CHAT_VIEWER_CONFIG_DIR`
- `AGENTS_CLI_CHAT_VIEWER_DATA_DIR`
- `WATCHER_VERBOSE_LOGS`

## For Contributors

### Bootstrap

```bash
npm run setup
```

This installs all dependencies, creates `backend/.env` if needed, and prepares runtime directories.

### Development

```bash
npm run dev
```

That runs backend and frontend dev servers together:

- Frontend dev UI: `http://localhost:5173`
- Backend API: `http://localhost:3000`

If you only want the dev servers after setup:

```bash
npm run dev:serve
```

### Verification

```bash
npm test
npm run lint
npm run build
npm run test:e2e --prefix frontend
```

## What The App Does

- Watches local agent log folders and indexes supported conversation files
- Shows a searchable conversation list with agent and archive filters
- Renders long transcripts in a virtualized detail view
- Adds transcript search, prompt navigation, session activity panels, and file lists
- Supports file preview, raw file access, export actions, and editor links for referenced files
- Updates the UI live through server-sent events when watched logs change

## Current UI Highlights

- Sidebar search plus agent filters for `all`, `claude`, `codex`, and `gemini`
- Grouped conversation list by agent and project
- Transcript focus mode and full-screen transcript mode
- In-conversation search with next/previous match navigation
- Prompt navigation between user messages
- Export menu for JSON, Markdown, and activity summaries
- File viewer modal with copy/open actions
- Watch folders onboarding wizard with suggested default sources and custom paths
- Local preference persistence for detail-view controls

## Project Structure

```text
backend/   Express API, watcher, parsing, indexing, production server
frontend/  React + Vite UI
docs/      Product notes and roadmap
specs/     Feature specs and implementation notes
scripts/   Local setup helpers
```

## Supported Sources

- Claude project/session logs
- Codex session logs
- Gemini chat/session exports supported by the parser fixtures

## Maintenance Note

When the product changes materially, update:

- `README.md` for setup and user-facing behavior
- `docs/improvement-roadmap.md` for shipped work and next priorities
