# Quickstart: Chat Dashboard

## 1. Project Setup
```bash
# Clone the repository
git clone [repo-url]
cd agents-cli-chat-viewer

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

## 2. Configuration
Create a `.env` file in the `backend/` directory:
```text
PORT=3000
LOGS_DIR=/path/to/your/agent/logs
```

## 3. Running the App
Open two terminals:

**Terminal 1 (Backend)**:
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend)**:
```bash
cd frontend
npm run dev
```

The dashboard will be available at `http://localhost:5173`.

## 4. Ingesting Logs
Drop any `.json` or `.md` conversation log from Gemini, Claude, or Codex into the configured `LOGS_DIR`. The dashboard will update automatically via SSE.
