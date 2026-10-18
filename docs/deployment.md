# Deployment

## Infrastructure

| Component | Detail |
|-----------|--------|
| VPS | Xserver VPS (`xserver_vps12_rmondo`) |
| Public URL | `https://mondo-ai-studio.xvps.jp/claude-logger/` |
| Reverse proxy | Caddy (`~/repos/reverse-proxy/Caddyfile`) |
| App container | `claude-logger-app` (Next.js standalone, port 3000) |
| Database | own `claude-logger-db` container (postgres:16-alpine, volume `claude-logger-db-data`, DB/user `claude_logger`); password only in `~/repos/claude-logger/.env` on the VPS |
| Docker networks | `claude-logger-network` |

## Deploy

```bash
# From local machine — commit, push, deploy. The image is built HERE, pushed to private GHCR
# (ghcr.io/ryosukemondo/claude-logger:<sha>), and the VPS pulls it. The VPS never builds.
git push origin main
bash deploy/deploy.sh              # also: --push-only | --status | --rollback
```

Baseline adopted from the pre-GHCR image: `ghcr.io/ryosukemondo/claude-logger:running-20261017`.

## Verify

```bash
# Container running?
ssh xserver_vps12_rmondo "docker ps --filter name=claude-logger"

# API responding?
curl -s https://mondo-ai-studio.xvps.jp/claude-logger/api/stats | python3 -m json.tool
```

## Docker Compose (VPS)

```yaml
services:
  app:
    container_name: claude-logger-app
    image: claude-logger-app:latest   # no build: on the VPS
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://claude_logger:${CLAUDE_LOGGER_DB_PASSWORD:?…}@claude-logger-db:5432/claude_logger
      BASE_PATH: /claude-logger
    depends_on: {db: {condition: service_healthy}}
    networks:
      - claude-logger-network
  db:   # claude-logger-db, see docker-compose.yml

networks:
  claude-logger-network:
    name: claude-logger-network
```

## Caddy Reverse Proxy

Config location: `~/repos/reverse-proxy/Caddyfile`

```
handle /claude-logger* {
    reverse_proxy claude-logger-app:3000
}
```

To reload Caddy after config changes:
```bash
ssh xserver_vps12_rmondo "cd ~/repos/reverse-proxy && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile"
```

## Database

PostgreSQL runs in its own `claude-logger-db` container (since 2026-10-18; before, it shared museum-map's postgres).

```bash
# Direct query
ssh xserver_vps12_rmondo "docker exec claude-logger-db psql -U claude_logger -d claude_logger -c '<SQL>'"

# Interactive
ssh xserver_vps12_rmondo "docker exec -it claude-logger-db psql -U claude_logger -d claude_logger"
```

Schema is auto-migrated on app startup (`src/lib/db.ts` → `initSchema()`).

## Rollback

```bash
bash deploy/deploy.sh --rollback   # swap back to the previous image (run again to go forward)
bash deploy/deploy.sh --status
```

## Local Development

```bash
# Start local postgres
docker start claude-logger-postgres   # port 5436

# Dev server
npm run dev                           # port 8111

# .env (local)
DATABASE_URL=postgresql://claude_logger:claude_logger_dev@localhost:5436/claude_logger
BASE_PATH=
```

## Hook Configuration

Claude Code hooks POST to:
- **Production**: `https://mondo-ai-studio.xvps.jp/claude-logger/api/hooks`
- **Local dev**: `http://192.168.11.24:8111/api/hooks`

Configured in `.claude/settings.local.json` (see `hooks-config-example.json` for reference).
