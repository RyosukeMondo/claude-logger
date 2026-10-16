# shellcheck shell=bash
# Sourced by deploy/deploy.sh; defines functions only.
#
# The image is built on the workstation and pushed to GHCR; the production VPS never builds. It pulls the pushed
# tag and retags it as the local name the compose file runs. Building on the shared VPS cost it minutes of CPU
# and most of its swap on every deploy (and a dockerd restart during a build once took every container down).

GHCR_REPO="${GHCR_REPO:-ghcr.io/ryosukemondo}"

# require_pushed
# Every GHCR sha tag must name a commit that exists on origin, so a tag can always be traced to public history.
require_pushed() {
  git fetch -q origin main
  git merge-base --is-ancestor HEAD origin/main || {
    echo "x HEAD is not on origin/main; push first (git push origin main)" >&2
    return 1
  }
}

# export_source DIR ALLOW_DIRTY PATHSPEC...
# Writes the tree to build into DIR: HEAD, or with ALLOW_DIRTY=1 HEAD plus the tracked working-tree changes
# (git stash create; new untracked files are NOT included). Only tracked files can reach the image this way, so a
# local .env, data/ or .venv never does, and file modes are git's (0644/0755).
export_source() {
  local dir="$1" allow_dirty="$2" rev="HEAD"
  shift 2
  if [ "$allow_dirty" = "1" ]; then
    rev="$(git stash create)"
    rev="${rev:-HEAD}"
    if [ -n "$(git ls-files --others --exclude-standard -- "$@")" ]; then
      echo "!! untracked files are not part of the image (commit them to ship them):" >&2
      git ls-files --others --exclude-standard -- "$@" | sed 's/^/   /' >&2
    fi
  fi
  git archive --format=tar "$rev" -- "$@" | tar -x -C "$dir"
}

# build_image CONTEXT REF [docker build args...]
build_image() {
  local ctx="$1" ref="$2"
  shift 2
  echo "~ docker build -> ${ref}"
  docker build --quiet -t "$ref" "$@" "$ctx" >/dev/null
}

# push_images REF...
push_images() {
  local ref
  for ref in "$@"; do
    echo "~ docker push ${ref}"
    docker push --quiet "$ref" >/dev/null
  done
}

# prune_local_tags REPO KEEP
# Untags all but the newest KEEP tags of one GHCR repository on this workstation (the build cache stays).
prune_local_tags() {
  local repo="$1" keep="$2" t
  for t in $(docker images "$repo" --format '{{.Tag}}' | { grep -v '^<none>$' || true; } | tail -n +"$((keep + 1))"); do
    docker rmi "${repo}:${t}" >/dev/null 2>&1 || echo "!! could not untag ${repo}:${t} locally" >&2
  done
}
