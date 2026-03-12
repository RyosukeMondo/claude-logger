# Deploy to VPS

## Trigger
When the user asks to deploy, push to production, or update the VPS.

## Steps

1. **Ensure changes are committed and pushed** to `origin/main`

2. **Deploy via SSH**:
```bash
ssh xserver_vps12_rmondo "cd ~/repos/claude-logger && git pull origin main && docker compose build --no-cache && docker compose up -d"
```

3. **Verify deployment**:
```bash
ssh xserver_vps12_rmondo "docker ps --filter 'name=claude-logger' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

4. **Smoke test** the production endpoint:
```bash
curl -s https://mondo-ai-studio.xvps.jp/claude-logger/api/stats | python3 -m json.tool
```

## Infrastructure

| Component | Detail |
|-----------|--------|
| SSH host | `xserver_vps12_rmondo` |
| Repo path | `~/repos/claude-logger` |
| Container | `claude-logger-app` (port 3000 internal) |
| Database | `postgresql://museum:museum_dev_password@museum-postgres:5432/claude_logger` (shared museum-network) |
| Reverse proxy | Caddy at `~/repos/reverse-proxy/Caddyfile` |
| Public URL | `https://mondo-ai-studio.xvps.jp/claude-logger/` |
| BASE_PATH | `/claude-logger` |
| Docker networks | `claude-logger-network`, `museum-map_museum-network` (external) |

## Caddy config (reference)
The relevant Caddy block in `~/repos/reverse-proxy/Caddyfile`:
```
handle /claude-logger* {
    reverse_proxy claude-logger-app:3000
}
```

## Rollback
```bash
ssh xserver_vps12_rmondo "cd ~/repos/claude-logger && git log --oneline -5"
# Then reset to desired commit:
ssh xserver_vps12_rmondo "cd ~/repos/claude-logger && git checkout <commit> && docker compose build --no-cache && docker compose up -d"
```
