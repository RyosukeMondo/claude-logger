# Claude Logger

```
 ╔═╗╦  ╔═╗╦ ╦╔╦╗╔═╗  ╦  ╔═╗╔═╗╔═╗╔═╗╦═╗
 ║  ║  ╠═╣║ ║ ║║║╣   ║  ║ ║║ ╦║ ╦║╣ ╠╦╝
 ╚═╝╩═╝╩ ╩╚═╝═╩╝╚═╝  ╩═╝╚═╝╚═╝╚═╝╚═╝╩╚═
```

REST API receiver and visualizer for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) hook events. Records all chat history, tool usage, and session activity. Share sessions with others via link.

## Quick Start

```bash
npm install
npm run dev        # starts on http://localhost:8111
```

## Setting Up Hooks

Claude Code hooks send HTTP POST events to claude-logger whenever Claude acts. You choose **where** to put the config to control scope:

| Scope | File | Effect |
|-------|------|--------|
| **Global** | `~/.claude/settings.json` | All projects, all sessions |
| **Project** | `<repo>/.claude/settings.json` | One repo (committed to git) |
| **Local** | `<repo>/.claude/settings.local.json` | One repo (gitignored) |

### Per-Project Setup (Recommended)

Create `.claude/settings.local.json` in any repo you want to log:

```json
{
  "hooks": {
    "SessionStart":       [{ "hooks": [{ "type": "http", "url": "http://localhost:8111/api/hooks" }] }],
    "SessionEnd":         [{ "hooks": [{ "type": "http", "url": "http://localhost:8111/api/hooks" }] }],
    "UserPromptSubmit":   [{ "hooks": [{ "type": "http", "url": "http://localhost:8111/api/hooks" }] }],
    "PreToolUse":         [{ "hooks": [{ "type": "http", "url": "http://localhost:8111/api/hooks" }] }],
    "PostToolUse":        [{ "hooks": [{ "type": "http", "url": "http://localhost:8111/api/hooks" }] }],
    "PostToolUseFailure": [{ "hooks": [{ "type": "http", "url": "http://localhost:8111/api/hooks" }] }],
    "Notification":       [{ "hooks": [{ "type": "http", "url": "http://localhost:8111/api/hooks" }] }],
    "Stop":               [{ "hooks": [{ "type": "http", "url": "http://localhost:8111/api/hooks" }] }]
  }
}
```

A complete example is in [`hooks-config-example.json`](./hooks-config-example.json).

### Selective Hooks

You don't need all events. Pick what you care about:

```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "http", "url": "http://localhost:8111/api/hooks" }] }],
    "Stop":             [{ "hooks": [{ "type": "http", "url": "http://localhost:8111/api/hooks" }] }]
  }
}
```

### Activating

Hooks take effect on the **next Claude Code session**. After saving the config, restart Claude Code (exit and reopen).

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

## Usage

### Web Dashboard

```bash
npm run dev    # http://localhost:8111
```

- `/` — Dashboard with session list, stats, tool usage bars
- `/sessions/:id` — Session timeline with event-by-event view
- `/share/:id` — Shareable public link

### CLI

```bash
npm run cli -- sessions           # list all sessions
npm run cli -- session <id>       # show session detail
npm run cli -- events <session-id> # show event timeline
npm run cli -- stats              # aggregate stats
npm run cli -- share <session-id>  # create share link
```

### REST API

```bash
# Data endpoints
curl http://localhost:8111/api/sessions
curl http://localhost:8111/api/sessions/<id>
curl http://localhost:8111/api/sessions/<id>/events
curl http://localhost:8111/api/stats

# Screen-as-JSON (returns exactly what the UI renders)
curl http://localhost:8111/api/views/dashboard
curl http://localhost:8111/api/views/session/<id>
curl http://localhost:8111/api/views/share/<id>

# Create share link
curl -X POST http://localhost:8111/api/sessions/<id>/share
```

## Testing

```bash
npm test           # run all tests
npm run test:watch # watch mode
```

## Architecture

```
src/lib/           Pure business logic (no framework deps)
src/app/api/       Next.js API routes
src/app/api/views/ Screen-as-JSON endpoints for testing
src/app/           Server-rendered pages
src/components/    React components (terminal theme)
src/cli/           CLI tool (same lib, no server needed)
tests/             Vitest unit tests against lib layer
```

All business logic lives in `src/lib/` and is shared by the web app, API, and CLI. The views API (`/api/views/*`) returns the exact data each page renders, making frontend behavior fully testable via REST.
