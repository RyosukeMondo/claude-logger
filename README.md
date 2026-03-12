# Claude Logger

```
 ╔═╗╦  ╔═╗╦ ╦╔╦╗╔═╗  ╦  ╔═╗╔═╗╔═╗╔═╗╦═╗
 ║  ║  ╠═╣║ ║ ║║║╣   ║  ║ ║║ ╦║ ╦║╣ ╠╦╝
 ╚═╝╩═╝╩ ╩╚═╝═╩╝╚═╝  ╩═╝╚═╝╚═╝╚═╝╚═╝╩╚═
```

Record and visualize all [Claude Code](https://docs.anthropic.com/en/docs/claude-code) activity — prompts, tool calls, sessions — via hooks. Terminal-themed dashboard with session sharing.

## Connect a Project

If someone shared an endpoint URL with you, create `.claude/settings.local.json` in the project you want to log:

```json
{
  "hooks": {
    "SessionStart":       [{ "hooks": [{ "type": "http", "url": "<ENDPOINT_URL>" }] }],
    "SessionEnd":         [{ "hooks": [{ "type": "http", "url": "<ENDPOINT_URL>" }] }],
    "UserPromptSubmit":   [{ "hooks": [{ "type": "http", "url": "<ENDPOINT_URL>" }] }],
    "PreToolUse":         [{ "hooks": [{ "type": "http", "url": "<ENDPOINT_URL>" }] }],
    "PostToolUse":        [{ "hooks": [{ "type": "http", "url": "<ENDPOINT_URL>" }] }],
    "PostToolUseFailure": [{ "hooks": [{ "type": "http", "url": "<ENDPOINT_URL>" }] }],
    "Notification":       [{ "hooks": [{ "type": "http", "url": "<ENDPOINT_URL>" }] }],
    "Stop":               [{ "hooks": [{ "type": "http", "url": "<ENDPOINT_URL>" }] }]
  }
}
```

Replace `<ENDPOINT_URL>` with the URL you were given (e.g. `https://example.com/claude-logger/api/hooks`).

Then restart Claude Code. All activity from that project will appear on the dashboard.

> **Tip**: Or just tell Claude Code:
> *"Please setup hooks for this project to POST to `<ENDPOINT_URL>` — create `.claude/settings.local.json` with all hook events."*

## Hook Scope Options

| Scope | File | Effect |
|-------|------|--------|
| **Local** | `<repo>/.claude/settings.local.json` | One repo, gitignored (recommended) |
| **Project** | `<repo>/.claude/settings.json` | One repo, committed to git |
| **Global** | `~/.claude/settings.json` | All projects, all sessions |

## Selective Hooks

You don't need all events. Pick what you care about:

```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "http", "url": "<ENDPOINT_URL>" }] }],
    "Stop":             [{ "hooks": [{ "type": "http", "url": "<ENDPOINT_URL>" }] }]
  }
}
```

## Hook Events Reference

| Event | What it captures |
|-------|-----------------|
| `SessionStart` | Session begins or resumes |
| `SessionEnd` | Session terminates |
| `UserPromptSubmit` | Every prompt you type |
| `PreToolUse` | Before tool runs (Bash, Read, Edit, Write, Grep, etc.) |
| `PostToolUse` | After tool succeeds |
| `PostToolUseFailure` | After tool fails |
| `Notification` | Permission prompts, idle notifications |
| `Stop` | Claude finishes a response |

## Self-Hosting

### Requirements

- Node.js 22+
- PostgreSQL 16+

### Setup

```bash
git clone https://github.com/RyosukeMondo/claude-logger.git
cd claude-logger
cp .env.example .env       # edit DATABASE_URL and BASE_PATH
npm install
npm run dev                 # http://localhost:8111
```

### Docker

```bash
docker compose up -d       # requires PostgreSQL on the same Docker network
```

See `docker-compose.yml` and `.env.example` for configuration.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://localhost:5432/claude_logger` |
| `BASE_PATH` | URL prefix for reverse proxy (e.g. `/claude-logger`) | *(empty)* |

## REST API

```bash
# Hook receiver (Claude Code POSTs here)
POST /api/hooks

# Data endpoints
GET  /api/sessions
GET  /api/sessions/:id
GET  /api/sessions/:id/events
GET  /api/stats
GET  /api/users
POST /api/sessions/:id/share

# Screen-as-JSON (returns exactly what the UI renders — useful for testing)
GET  /api/views/dashboard
GET  /api/views/session/:id
GET  /api/views/share/:id
```

## CLI

```bash
npm run cli -- users                # list all users
npm run cli -- sessions [--user X]  # list sessions
npm run cli -- session <id>         # session detail
npm run cli -- events <session-id>  # event timeline
npm run cli -- stats [--user X]     # aggregate stats
npm run cli -- share <session-id>   # create share link
```

## Architecture

```
src/lib/           Pure business logic (framework-free, testable via CLI)
src/app/api/       Next.js API routes
src/app/api/views/ Screen-as-JSON endpoints for frontend verification
src/app/           Server-rendered pages
src/components/    React components (terminal theme)
src/cli/           CLI tool (same lib, no server needed)
tests/             Vitest unit tests against lib layer
```
