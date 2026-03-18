#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_ENV_EXAMPLE="$BACKEND_DIR/.env.example"
BACKEND_ENV="$BACKEND_DIR/.env"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/agents-cli-chat-viewer"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/agents-cli-chat-viewer"
LOGS_DIR="$DATA_DIR/logs"
WATCH_FOLDERS_CONFIG="$CONFIG_DIR/watch-folders.json"
CONVERSATION_INDEX_CACHE="$CONFIG_DIR/conversation-index-cache.json"

echo "==> Installing root dependencies"
npm install --prefix "$ROOT_DIR"

echo "==> Installing backend dependencies"
npm install --prefix "$BACKEND_DIR"

echo "==> Installing frontend dependencies"
npm install --prefix "$FRONTEND_DIR"

echo "==> Ensuring runtime directories exist"
mkdir -p "$LOGS_DIR"
mkdir -p "$CONFIG_DIR"

if [ ! -f "$BACKEND_ENV" ]; then
  echo "==> Creating backend/.env"
  cp "$BACKEND_ENV_EXAMPLE" "$BACKEND_ENV"
  cat > "$BACKEND_ENV" <<EOF
PORT=3000
LOGS_DIR=$LOGS_DIR
WATCH_FOLDERS_CONFIG=$WATCH_FOLDERS_CONFIG
CONVERSATION_INDEX_CACHE=$CONVERSATION_INDEX_CACHE
AGENTS_CLI_CHAT_VIEWER_CONFIG_DIR=$CONFIG_DIR
AGENTS_CLI_CHAT_VIEWER_DATA_DIR=$DATA_DIR
WATCHER_VERBOSE_LOGS=false
EOF
else
  echo "==> backend/.env already exists, leaving it untouched"
fi

echo
echo "Setup complete."
echo
echo "Runtime data:"
echo "  Config dir: $CONFIG_DIR"
echo "  Data dir:   $DATA_DIR"
echo "  Logs dir:   $LOGS_DIR"
echo
echo "Next steps:"
echo "  1. Run everything:     npm run dev"
echo "  2. Production start:   npm start"
echo "  3. Serve dev only:     npm run dev:serve"
echo "  4. Backend only:       npm run dev --prefix backend"
echo "  5. Frontend only:      npm run dev --prefix frontend"
echo
echo "Frontend URL: http://localhost:5173"
echo "Backend URL:  http://localhost:3000"
echo
echo "The onboarding wizard in the UI can enable detected Claude/Codex/Gemini folders."
