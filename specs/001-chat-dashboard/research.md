# Research: Chat Dashboard Architecture

## Decision: Vite + React (SPA) with a Node.js (Express) Backend

### Rationale
To meet the "Lightweight & Reactive" core principle, a Vite-powered SPA provides the fastest development feedback loop and a minimal footprint. Next.js is powerful but introduces complexity (SSR, server components) that isn't strictly necessary for a local-first conversation viewer. A separate Express backend allows for clean separation of concerns when watching local directories for log changes.

### Alternatives Considered

#### Option 1: Next.js (App Router)
- **Pros**: Built-in API routes, excellent performance optimization.
- **Cons**: Higher overhead, more "magic" in the build process, slightly slower cold starts for a local tool.
- **Verdict**: Rejected in favor of a simpler Vite/Express split for maximum transparency and idiomatic simplicity.

#### Option 2: Pure Desktop App (Electron)
- **Pros**: Deep OS integration, no need for browser tab.
- **Cons**: Massive resource usage (Chromium + Node for every instance), violates "lightweight" principle.
- **Verdict**: Rejected. A web-based viewer accessed via localhost is preferred.

## Best Practices

### Frontend (React/TS)
- Use **TanStack Query** for reactive data fetching and caching of logs.
- Use **Zustand** for lightweight state management (archiving/filtering state).
- Use **Tailwind CSS** or **Vanilla CSS**? Constitution doesn't specify. I will stick to **Vanilla CSS** for the "Lightweight" principle unless a specific library is needed for the dashboard's "Powerful" aspect.
- **Virtual Scrolling**: Mandatory for User Story 1 (Unified Viewer) to handle "Extreme Log Size" edge case.

### Backend (Node/Express)
- **chokidar**: For efficient, cross-platform file watching of log directories.
- **Zod**: For robust schema validation of incoming agent logs (Gemini, Claude, Codex).

## Integration Patterns

- **Polling vs WebSockets**: For real-time updates when a new log appears, WebSockets (socket.io) or Server-Sent Events (SSE) will be used to ensure the "Reactive" principle. SSE is preferred for its simplicity in one-way data flow (server -> client).
