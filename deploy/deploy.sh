#!/usr/bin/env bash
# deploy.sh — build the image HERE, push it to GHCR, and have the VPS pull and (re)start it.
#
#   bash deploy/deploy.sh                deploy HEAD (must be pushed to origin/main)
#   bash deploy/deploy.sh --push-only    build + push to GHCR, do not touch the VPS
#   bash deploy/deploy.sh --allow-dirty  ship HEAD plus tracked working-tree changes (tag gets -dirty)
#   bash deploy/deploy.sh --rollback     run the previous image again (swap; running it twice goes forward)
#   bash deploy/deploy.sh --status       show what runs on the VPS; changes nothing
#
# Where the image is built: on this workstation, never on the VPS. The committed tree (git archive, tracked files
# only) is built here, pushed to ghcr.io/ryosukemondo/claude-logger:<short-sha> (private package), and the VPS pulls
# that tag and retags it claude-logger-app:latest, the name docker-compose.yml runs. Only the compose file and
# what the containers bind-mount go to the VPS (SYNC_PATHS below): no source tree, no .env, no data.
# The previous image is kept as claude-logger-app:rollback.
#
# docker-compose.yml has no `build:` (production never builds). For local dev use the build override:
#   docker compose -f docker-compose.yml -f docker-compose.build.yml up --build
#
# Prereqs (one-time, already provisioned): this machine and the VPS are `docker login`ed to ghcr.io.
# Adopted baseline: ghcr.io/ryosukemondo/claude-logger:running-<date> is the image that ran on the VPS before this script.
#
# Only claude-logger images and containers are touched on the VPS. Never prune anything there: it is shared production.
set -euo pipefail

HOST="${HOST:-xserver_vps12_rmondo}"
REMOTE_DIR="${REMOTE_DIR:-/home/rmondo/repos/claude-logger}"
NAME=claude-logger                       # GHCR package name
LOCAL_NAME=claude-logger-app                # image name the compose file runs
SERVICE=app                 # compose service to recreate
CONTAINER=claude-logger-app
PUBLIC_URL="${PUBLIC_URL:-https://mondo-ai-studio.xvps.jp/claude-logger}" # must answer 200 after a deploy
# Tracked paths the Dockerfile COPYs, and the files sent to the VPS (both relative to the repo root).
BUILD_PATHS=(.)
SYNC_PATHS=(docker-compose.yml)

ALLOW_DIRTY=0
MODE=deploy
for arg in "$@"; do
  case "$arg" in
    --allow-dirty) ALLOW_DIRTY=1 ;;
    --push-only) MODE=push ;;
    --rollback) MODE=rollback ;;
    --status) MODE=status ;;
    --help|-h) sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "x unknown argument: ${arg} (see --help)" >&2; exit 1 ;;
  esac
done

cd "$(dirname "$0")/.."

# Wait (up to 90 s) for the container to run (and be healthy if it has a healthcheck), then show it. Runs on the VPS.
REMOTE_VERIFY="
for i in \$(seq 1 45); do
  state=\"\$(docker inspect -f '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}nohealth{{end}}' $CONTAINER 2>/dev/null || true)\"
  case \"\$state\" in running/healthy|running/nohealth) [ \$i -ge 3 ] && break ;; esac
  sleep 2
done
echo \"container state: \${state:-missing}\"
docker ps --filter name=^/$CONTAINER\$ --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
case \"\$state\" in running/healthy|running/nohealth) ;; *) echo \"x $CONTAINER is not up; docker logs $CONTAINER\" >&2; exit 1 ;; esac
[ \"\$(docker inspect -f '{{.Image}}' $CONTAINER)\" = \"\$(docker image inspect -f '{{.Id}}' $LOCAL_NAME:latest)\" ] || { echo 'x container is not running $LOCAL_NAME:latest' >&2; exit 1; }
"

check_public() {
  local code i
  for i in 1 2 3 4 5 6; do
    code="$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "$PUBLIC_URL" || true)"
    [ "$code" = 200 ] && { echo "* ${PUBLIC_URL} -> 200"; return 0; }
    sleep 5
  done
  echo "x ${PUBLIC_URL} -> ${code:-no answer}" >&2
  return 1
}

if [ "$MODE" = status ]; then
  ssh "$HOST" "docker ps -a --filter name=^/$CONTAINER\$ --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
    echo \"running image id: \$(docker inspect -f '{{.Image}}' $CONTAINER 2>/dev/null)\"
    docker images $LOCAL_NAME --format 'table {{.Tag}}\t{{.ID}}\t{{.CreatedSince}}'
    echo \"deployed: \$(cat '$REMOTE_DIR/.deployed-sha' 2>/dev/null || echo '(no .deployed-sha: pre-GHCR image)')\"
    echo \"rollback: \$(cat '$REMOTE_DIR/.rollback-sha' 2>/dev/null || echo '(none)')\""
  exit 0
fi

if [ "$MODE" = rollback ]; then
  ssh "$HOST" 'bash -s' <<REMOTE
set -euo pipefail
cd "$REMOTE_DIR"
docker image inspect $LOCAL_NAME:rollback >/dev/null 2>&1 || { echo "x $LOCAL_NAME:rollback does not exist" >&2; exit 1; }
# Swap :latest and :rollback and keep .deployed-sha honest: it must name what runs now.
docker tag $LOCAL_NAME:latest $LOCAL_NAME:swap-tmp
docker tag $LOCAL_NAME:rollback $LOCAL_NAME:latest
docker tag $LOCAL_NAME:swap-tmp $LOCAL_NAME:rollback
docker rmi $LOCAL_NAME:swap-tmp >/dev/null
now=unknown; prev=unknown
[ -f .rollback-sha ] && now="\$(cat .rollback-sha)"
[ -f .deployed-sha ] && prev="\$(cat .deployed-sha)"
echo "\$now" > .deployed-sha
echo "\$prev" > .rollback-sha
echo "~ now running: \$now (previous: \$prev)"
docker compose up -d --no-build --force-recreate $SERVICE
$REMOTE_VERIFY
REMOTE
  check_public
  exit 0
fi

# --- decide what to ship ---
GIT_SHA="$(git rev-parse --short HEAD)"
SHA="$GIT_SHA"
# shellcheck source=deploy/lib/ghcr.sh
. deploy/lib/ghcr.sh
require_pushed || exit 1
if [ -n "$(git status --porcelain --untracked-files=no -- "${BUILD_PATHS[@]}")" ]; then
  if [ "$ALLOW_DIRTY" != 1 ]; then
    echo "!! tracked uncommitted changes are NOT part of this build (HEAD ${GIT_SHA} only); --allow-dirty ships them" >&2
  else
    echo "!! deploying tracked uncommitted changes as ${GIT_SHA}-dirty" >&2
    SHA="${GIT_SHA}-dirty"
  fi
fi

# --- build here, push to GHCR ---
GHCR_IMAGE="${GHCR_REPO}/${NAME}"
mkdir -p /tmp/claude-1000/ctx
BUILD_CTX="$(mktemp -d "/tmp/claude-1000/ctx/${NAME}.XXXXXX")" # not plain /tmp: other sessions wipe it mid-build
trap 'rm -rf "$BUILD_CTX"' EXIT
echo "~ exporting ${SHA} for the image build"
export_source "$BUILD_CTX" "$ALLOW_DIRTY" "${BUILD_PATHS[@]}" "${SYNC_PATHS[@]}"
# Serialize local builds across parallel sessions (the workstation is shared and heavily loaded).
mkdir -p /tmp/claude-1000
flock /tmp/claude-1000/ghcr-build.lock bash -c '. deploy/lib/ghcr.sh; build_image "$@"' _ "$BUILD_CTX" "${GHCR_IMAGE}:${SHA}" 
push_images "${GHCR_IMAGE}:${SHA}"
prune_local_tags "$GHCR_IMAGE" 3
[ "$MODE" = push ] && { echo "* pushed ${GHCR_IMAGE}:${SHA} (VPS untouched)"; exit 0; }

# Only the files in SYNC_PATHS go to the VPS (from the exported tree, so they match the image).
ssh "$HOST" "mkdir -p '$REMOTE_DIR'"
echo "~ ${SYNC_PATHS[*]} -> ${HOST}:${REMOTE_DIR}"
(cd "$BUILD_CTX" && rsync -aR -e ssh "${SYNC_PATHS[@]}" "${HOST}:${REMOTE_DIR}/")

# Unquoted heredoc: expanded locally, so no backticks and escape remote-side variables as \$.
ssh "$HOST" 'bash -s' <<REMOTE
set -euo pipefail
cd "$REMOTE_DIR"

# The database password lives only in .env on the VPS (never in git). Stop before changing anything without it.
grep -q '^CLAUDE_LOGGER_DB_PASSWORD=.' .env 2>/dev/null || { echo "x .env lacks CLAUDE_LOGGER_DB_PASSWORD in \$PWD" >&2; exit 1; }

# Pull first: if the registry is unreachable nothing below has changed yet.
echo "~ pulling ${GHCR_IMAGE}:${SHA}"
docker pull --quiet "${GHCR_IMAGE}:${SHA}" >/dev/null

# Keep the image that runs now as :rollback. Do it before :latest is moved.
if docker image inspect $LOCAL_NAME:latest >/dev/null 2>&1; then
  docker tag $LOCAL_NAME:latest $LOCAL_NAME:rollback
  if [ -f .deployed-sha ]; then cp .deployed-sha .rollback-sha; else echo "pre-GHCR (${GHCR_IMAGE}:running-*)" > .rollback-sha; fi
fi

# The compose file runs the local name. The GHCR name is untagged afterwards; the image stays under the local names.
docker tag "${GHCR_IMAGE}:${SHA}" $LOCAL_NAME:latest
docker tag "${GHCR_IMAGE}:${SHA}" $LOCAL_NAME:${SHA}
docker rmi "${GHCR_IMAGE}:${SHA}" >/dev/null
echo "${SHA}" > .deployed-sha

docker compose up -d --no-build --force-recreate $SERVICE
$REMOTE_VERIFY

# Housekeeping, $NAME only: SHA tags older than the newest 3 (:latest and :rollback already pin the two newest
# generations). No prune of any kind: the VPS is shared, so only our own tags are ever removed.
old_tags="\$(docker images $LOCAL_NAME --format '{{.Tag}}' | { grep -Ev '^(latest|rollback|<none>)\$' || true; } | tail -n +4)"
for t in \$old_tags; do
  docker rmi "$LOCAL_NAME:\$t" >/dev/null 2>&1 || echo "x could not remove $LOCAL_NAME:\$t" >&2
done
docker images $LOCAL_NAME --format 'table {{.Tag}}\t{{.ID}}\t{{.CreatedSince}}'
REMOTE
check_public
echo "* deployed ${SHA} to ${HOST}"
