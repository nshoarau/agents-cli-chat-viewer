# Tasks: Chat Dashboard

**Input**: Design documents from `/specs/001-chat-dashboard/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize backend Node.js project in /backend
- [x] T002 Initialize frontend Vite/React project in /frontend
- [x] T003 [P] Install backend dependencies (express, zod, chokidar, typescript, vitest) in /backend/package.json
- [x] T004 [P] Install frontend dependencies (react, tanstack-query, zustand, typescript, vitest) in /frontend/package.json
- [x] T005 [P] Configure shared linting and formatting in /.eslintrc.json and /.prettierrc

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T006 Setup Express server with TypeScript in /backend/src/index.ts
- [x] T007 Implement Zod schemas for Gemini, Claude, and Codex logs in /backend/src/schemas/logSchemas.ts
- [x] T008 Implement File System Watcher service in /backend/src/services/watcherService.ts
- [x] T009 [P] Setup basic API routing structure in /backend/src/routes/index.ts
- [x] T010 [P] Setup Server-Sent Events (SSE) endpoint for log updates in /backend/src/routes/events.ts
- [x] T011 [P] Setup TanStack Query and API client in /frontend/src/services/apiClient.ts

**Checkpoint**: Foundation ready - backend can watch files and frontend can communicate with it.

---

## Phase 3: User Story 1 - Unified Agent Conversation Viewer (Priority: P1) 🎯 MVP

**Goal**: Display conversation logs from Gemini, Claude, and Codex in a unified list.

**Independent Test**: Load one log file of each agent type into the watch directory and verify they appear in the UI list and detail view.

- [x] T012 [P] [US1] Create Conversation and Message types in /frontend/src/types/index.ts
- [x] T013 [P] [US1] Implement log parsing logic for all 3 agents in /backend/src/services/parserService.ts
- [x] T014 [US1] Implement GET /conversations endpoint in /backend/src/routes/conversations.ts
- [x] T015 [US1] Implement GET /conversations/:id endpoint in /backend/src/routes/conversations.ts
- [x] T016 [US1] Create Unified List component in /frontend/src/components/ConversationList.tsx
- [x] T017 [US1] Create Conversation Detail component with Markdown rendering in /frontend/src/components/ConversationDetail.tsx
- [x] T018 [US1] Integrate SSE in frontend to refresh list on new logs in /frontend/src/hooks/useLogUpdates.ts

**Checkpoint**: MVP Complete. Unified viewing of all agents is functional.

---

## Phase 4: User Story 2 - Basic Conversation Management (Priority: P2)

**Goal**: Archive or delete specific conversations.

**Independent Test**: Click "Archive" on a conversation and verify it moves to the "Archived" filter/view.

- [x] T019 [P] [US2] Implement archive/restore state management in /frontend/src/store/useConversationStore.ts
- [x] T020 [US2] Implement PATCH /conversations/:id/status endpoint in /backend/src/routes/conversations.ts
- [x] T021 [US2] Implement DELETE /conversations/:id endpoint in /backend/src/routes/conversations.ts
- [x] T022 [US2] Add Archive and Delete buttons to UI components in /frontend/src/components/ConversationActions.tsx
- [x] T023 [US2] Add "Show Archived" toggle filter in /frontend/src/components/FilterBar.tsx

**Checkpoint**: Management functionality complete.

---

## Phase 5: User Story 3 - Instant Reactive Search (Priority: P3)

**Goal**: Search through text of all conversations instantly as-you-type.

**Independent Test**: Type a unique string from a deep conversation and verify only that conversation remains in the list.

- [x] T024 [P] [US3] Implement search filtering logic in /frontend/src/store/useConversationStore.ts
- [x] T025 [US3] Create Search Bar component in /frontend/src/components/SearchBar.tsx
- [x] T026 [US3] Optimize search performance for up to 1,000 conversations using useMemo in /frontend/src/components/Dashboard.tsx

**Checkpoint**: All user stories functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T027 [P] Implement syntax highlighting for code blocks in /frontend/src/components/CodeBlock.tsx
- [x] T028 Implement Virtual Scrolling for the unified list in /frontend/src/components/ConversationList.tsx
- [x] T029 Add basic CSS transitions for reactive feel in /frontend/src/styles/App.css
- [x] T030 Final validation against quickstart.md steps

---

## Dependencies & Execution Order

### Phase Dependencies
- Setup (Phase 1) → Foundational (Phase 2)
- Foundational (Phase 2) → User Story 1 (Phase 3)
- User Story 1 (Phase 3) → User Story 2 & 3 (Phases 4 & 5)

### Parallel Opportunities
- T003-T005 (Setup)
- T009-T011 (Foundational)
- T012-T013 (US1 Models/Parsing)
- Phases 4 and 5 can be worked on in parallel once Phase 3 is stable.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Setup + Foundational.
2. Complete Unified Viewer (US1).
3. Verify that all 3 agent types are readable in one place.

### Incremental Delivery
- Each phase adds a standalone value increment.
- SSE integration (T018) is key for the "reactive" feel required by the constitution.
