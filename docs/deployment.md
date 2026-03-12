# Deployment

## Infrastructure

| Component | Detail |
|-----------|--------|
| VPS | Xserver VPS (`xserver_vps12_rmondo`) |
| Public URL | `https://mondo-ai-studio.xvps.jp/claude-logger/` |
| Reverse proxy | Caddy (`~/repos/reverse-proxy/Caddyfile`) |
| App container | `claude-logger-app` (Next.js standalone, port 3000) |
| Database | PostgreSQL on `museum-postgres` container, DB: `claude_logger` |
| Docker networks | `claude-logger-network` + `museum-map_museum-network` (external) |

## Deploy

```bash
# From local machine — commit, push, deploy:
git push origin main
ssh xserver_vps12_rmondo "cd ~/repos/claude-logger && git pull origin main && docker compose build --no-cache && docker compose up -d"
```

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
    build: .
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://museum:museum_dev_password@museum-postgres:5432/claude_logger
      BASE_PATH: /claude-logger
    networks:
      - claude-logger-network
      - museum-network

networks:
  claude-logger-network:
    name: claude-logger-network
  museum-network:
    external: true
    name: museum-map_museum-network
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

PostgreSQL runs in the shared `museum-postgres` container (used by multiple projects).

```bash
# Direct query
ssh xserver_vps12_rmondo "docker exec museum-postgres psql -U museum -d claude_logger -c '<SQL>'"

# Interactive
ssh xserver_vps12_rmondo "docker exec -it museum-postgres psql -U museum -d claude_logger"
```

Schema is auto-migrated on app startup (`src/lib/db.ts` → `initSchema()`).

## Rollback

```bash
ssh xserver_vps12_rmondo "cd ~/repos/claude-logger && git log --oneline -10"
ssh xserver_vps12_rmondo "cd ~/repos/claude-logger && git checkout <commit> && docker compose build --no-cache && docker compose up -d"
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
