# API Contract: Chat Dashboard

## Base URL
`http://localhost:3000/api`

## Endpoints

### 1. List Conversations
Returns a chronological list of all detected conversations.
- **URL**: `/conversations`
- **Method**: `GET`
- **Query Params**:
  - `agentType`: Filter by agent.
  - `status`: Filter by status (active/archived).
  - `search`: Full-text search string.
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "conv-123",
      "agentType": "gemini",
      "timestamp": "2026-03-16T10:00:00Z",
      "title": "Initial Setup Discussion",
      "status": "active"
    }
  ]
  ```

### 2. Get Conversation Detail
Returns the full conversation thread for a given ID.
- **URL**: `/conversations/:id`
- **Method**: `GET`
- **Success Response (200 OK)**:
  ```json
  {
    "id": "conv-123",
    "agentType": "gemini",
    "timestamp": "2026-03-16T10:00:00Z",
    "title": "Initial Setup Discussion",
    "status": "active",
    "messages": [
      {
        "sender": "user",
        "content": "Hello",
        "timestamp": "2026-03-16T10:00:05Z"
      }
    ]
  }
  ```

### 3. Update Conversation Status (Archive/Restore)
- **URL**: `/conversations/:id/status`
- **Method**: `PATCH`
- **Body**: `{ "status": "archived" | "active" }`
- **Success Response (204 No Content)**

### 4. Delete Conversation
- **URL**: `/conversations/:id`
- **Method**: `DELETE`
- **Success Response (204 No Content)**

## Real-time Updates (SSE)
- **URL**: `/events`
- **Protocol**: Server-Sent Events
- **Description**: Notifies client of new log files detected or existing log files updated.
- **Event Type**: `log-update`
- **Data**: `{ "id": "conv-123", "type": "new" | "updated" }`
