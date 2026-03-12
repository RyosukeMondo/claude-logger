# Debug Tools

## Trigger
When debugging issues, investigating data, or verifying behavior.

## Two debug paths

### 1. CLI — Business logic debugging
Use the CLI tool to exercise `src/lib/` directly (bypasses Next.js):

```bash
# List sessions
npm run cli -- sessions

# Filter by user
npm run cli -- sessions --user rmondo

# View session detail (JSON)
npm run cli -- session <session-id>

# View event timeline
npm run cli -- events <session-id>

# Aggregate stats
npm run cli -- stats
npm run cli -- stats --user rmondo

# Create share link
npm run cli -- share <session-id>
```

The CLI uses the same `src/lib/` functions as the web server. If the CLI output is correct but the web UI is wrong, the bug is in the rendering layer (components/CSS). If the CLI output is also wrong, the bug is in the business logic (`src/lib/`).

### 2. REST API `/api/views/*` — GUI layout debugging
Screen-as-JSON endpoints return the exact data the server-rendered pages use. Fetch these to verify what the browser receives without opening a browser:

```bash
# Dashboard view (sessions list, stats, tool usage)
curl -s http://localhost:8111/api/views/dashboard | python3 -m json.tool

# Session detail view (session + events)
curl -s http://localhost:8111/api/views/session/<id> | python3 -m json.tool

# Share view
curl -s http://localhost:8111/api/views/share/<id> | python3 -m json.tool
```

For production:
```bash
curl -s https://mondo-ai-studio.xvps.jp/claude-logger/api/views/dashboard | python3 -m json.tool
```

### Raw data endpoints
```bash
# Sessions list (with pagination)
curl -s http://localhost:8111/api/sessions?limit=10&offset=0

# Single session
curl -s http://localhost:8111/api/sessions/<id>

# Events for session
curl -s http://localhost:8111/api/sessions/<id>/events

# Stats
curl -s http://localhost:8111/api/stats?user=rmondo

# Users
curl -s http://localhost:8111/api/users
```

## Debug decision tree

```
Issue reported
├── Data wrong? (timestamps, counts, missing records)
│   ├── CLI shows wrong data → bug in src/lib/
│   └── CLI correct, API wrong → bug in API route
├── Layout wrong? (alignment, spacing, missing elements)
│   ├── /api/views/* JSON correct → bug in components/CSS
│   └── /api/views/* JSON wrong → bug in page.tsx data fetching
└── Not loading? (500, blank page)
    ├── Check: docker ps / process running?
    ├── Check: curl localhost → connection refused? → restart
    └── Check: docker logs claude-logger-app
```
