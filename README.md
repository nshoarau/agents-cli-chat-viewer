# agents-cli-chat-viewer

A local dashboard for browsing CLI agent conversations from Codex, Claude, and Gemini.

## What It Does

- Watches local agent log folders and indexes supported conversation files.
- Shows a searchable conversation list with agent and archive filters.
- Renders long transcripts in a virtualized detail view for better performance.
- Adds transcript search, prompt-to-prompt navigation, session activity panels, and file lists.
- Supports file preview, raw file access, export actions, and editor links for referenced files.
- Updates the UI live through server-sent events when watched logs change.

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
backend/   Express API, log watcher, indexing, parsing
frontend/  React + Vite dashboard
docs/      Product notes and roadmap
specs/     Feature specs and implementation notes
```

## Quick Start

### 1. Install dependencies

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

### 2. Start the app

Run both servers in separate terminals:

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

Or from the repo root:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:3000`

### 3. Add logs

The backend watches `backend/logs` by default.

You can also add folders from the UI:

1. Open `Watched Folders`
2. Enable any suggested Claude, Codex, or Gemini source with one click
3. Or add an absolute custom path to a file or directory containing supported logs
4. The backend links that source into its watched logs area and rebuilds the index

The backend also auto-discovers common default locations when they exist:

- `~/.claude/projects`
- `~/.codex/sessions`
- `~/.gemini/tmp`

## Supported Sources

- Claude project/session logs
- Codex session logs
- Gemini chat/session exports already supported by the parser fixtures

## Useful Commands

```bash
npm run dev
npm test
npm run lint
npm run test:e2e
```

## Configuration Notes

- `PORT` defaults to `3000`
- `LOGS_DIR` defaults to `backend/logs`
- `WATCH_FOLDERS_CONFIG` defaults to `backend/config/watch-folders.json`

These can be set through `backend/.env` if needed.

## Maintenance Note

This README should track user-visible behavior. When the UI changes materially, update:

- `README.md` for feature and setup changes
- `docs/improvement-roadmap.md` for shipped work and next priorities
