# Debugging Guide

## Architecture for Debugging

Claude Logger has a layered architecture designed for isolated debugging:

```
┌──────────────┐  ┌──────────────┐
│   Next.js    │  │     CLI      │
│  Pages/API   │  │  (npm run    │
│   Routes     │  │    cli)      │
└──────┬───────┘  └──────┬───────┘
       │                 │
       └────────┬────────┘
                │
       ┌────────▼────────┐
       │    src/lib/      │  ← Business logic (SSOT)
       │  events.ts       │
       │  sessions.ts     │
       │  shares.ts       │
       │  time.ts         │
       └────────┬────────┘
                │
       ┌────────▼────────┐
       │   PostgreSQL     │
       └─────────────────┘
```

Both the web UI and CLI share the same `src/lib/` layer. This means:
- **CLI** tests business logic in isolation from Next.js
- **`/api/views/*`** endpoints expose the exact view model data that pages render

## CLI Debug Tool

```bash
npm run cli -- sessions              # list all sessions
npm run cli -- sessions --user X     # filter by user
npm run cli -- session <id>          # session JSON
npm run cli -- events <session-id>   # event timeline
npm run cli -- stats                 # aggregate stats
npm run cli -- share <session-id>    # create share link
```

## REST API Debug Endpoints

### View model endpoints (what the pages render)
| Endpoint | Description |
|----------|-------------|
| `GET /api/views/dashboard` | Dashboard page data: users, stats, sessions |
| `GET /api/views/session/:id` | Session page data: session + events |
| `GET /api/views/share/:id` | Share page data: share + session + events |

### Raw data endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /api/sessions?limit=N&offset=N&user=X` | Paginated sessions |
| `GET /api/sessions/:id` | Single session |
| `GET /api/sessions/:id/events` | Events for session |
| `GET /api/stats?user=X` | Aggregate statistics |
| `GET /api/users` | Distinct usernames |
| `POST /api/hooks` | Hook event receiver |

### Example: diagnose a display issue
```bash
# 1. Check if business logic returns correct data
npm run cli -- events <session-id>

# 2. Check if the API view model is correct
curl -s http://localhost:8111/api/views/session/<id> | python3 -m json.tool

# 3. If both correct → bug is in React components / CSS
# 4. If CLI wrong → bug is in src/lib/
# 5. If CLI correct but API wrong → bug is in the API route
```

## Debug Decision Tree

```
Issue reported
├── Data wrong? (timestamps, counts, missing records)
│   ├── CLI shows wrong data → bug in src/lib/
│   └── CLI correct, API wrong → bug in API route handler
├── Layout/rendering wrong?
│   ├── /api/views/* JSON has correct data → bug in components or CSS
│   └── /api/views/* JSON has wrong data → bug in page.tsx
└── Not loading at all?
    ├── Connection refused → server not running
    ├── 502 Bad Gateway → container running but not bound to 0.0.0.0
    └── 500 Error → check logs: docker logs claude-logger-app
```

## Local Development

```bash
# Start dev server (requires local postgres on port 5436)
docker start claude-logger-postgres
npm run dev

# Run tests
npm test

# Build production
npm run build
```

## Production Debugging

```bash
# Check container status
ssh xserver_vps12_rmondo "docker ps --filter name=claude-logger"

# View logs
ssh xserver_vps12_rmondo "docker logs --tail 50 claude-logger-app"

# Test production API
curl -s https://mondo-ai-studio.xvps.jp/claude-logger/api/stats | python3 -m json.tool

# Database access (via museum-postgres container)
ssh xserver_vps12_rmondo "docker exec museum-postgres psql -U museum -d claude_logger -c 'SELECT count(*) FROM events;'"
```
