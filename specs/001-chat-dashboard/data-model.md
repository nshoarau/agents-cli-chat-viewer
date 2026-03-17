# Data Model: Chat Dashboard

## Entities

### Conversation
Represents a single session with an agent.
- `id`: string (UUID or derived from file name)
- `agentType`: enum ('gemini', 'claude', 'codex')
- `timestamp`: ISO-8601 (Creation date)
- `title`: string (Auto-generated or user-specified)
- `status`: enum ('active', 'archived')
- `filePath`: string (Relative path to the log file)
- `messages`: Message[]

### Message
A single turn in a conversation.
- `id`: string
- `sender`: enum ('user', 'agent')
- `content`: string (Markdown format)
- `timestamp`: ISO-8601 (When sent)

## State Transitions
1. **Active** → **Archived**: Manual user action to archive.
2. **Archived** → **Active**: Manual user action to restore.
3. **Any** → **Deleted**: Manual user action to delete the underlying log file.

## Validation Rules
- `agentType` must be one of the three supported agents.
- `timestamp` must be a valid date string.
- `messages` must contain at least one user input.
