#!/usr/bin/env bash
# Read and write OpenProject work packages through its REST API v3.
#
# Credentials come from .env.local at the repo root (see .env.local.example).
# The token is passed to curl over stdin, never on the command line, so it does
# not land in the process list or in shell history.
#
# Only GET, POST and PATCH exist here. There is deliberately no DELETE path:
# every destructive OpenProject API operation is an HTTP DELETE, so omitting the
# verb removes the capability rather than guarding it.
#
# Usage:
#   scripts/dev/openproject.sh get    <path>            # e.g. /api/v3/work_packages/363
#   scripts/dev/openproject.sh post   <path> <json|@file|->
#   scripts/dev/openproject.sh patch  <path> <json|@file|->
#   scripts/dev/openproject.sh wp     <id>              # one work package
#   scripts/dev/openproject.sh children <id>            # direct children of a work package
#   scripts/dev/openproject.sh statuses                 # id -> name status list
#   scripts/dev/openproject.sh boards                   # boards, with the sprint each one filters on
#   scripts/dev/openproject.sh sprint <id> [status-id]  # work packages on a sprint board
#   scripts/dev/openproject.sh status <id> <status-id>  # move a work package (handles lockVersion)
#   scripts/dev/openproject.sh comment <id> <text>      # add a comment
#
# Set OPEN_PROJECT_READONLY=true to make every write fail closed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${OPEN_PROJECT_ENV_FILE:-$REPO_ROOT/.env.local}"

die() { printf '%s\n' "$*" >&2; exit 1; }

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

[ -n "${OPEN_PROJECT_BASE_URL:-}" ] || die "OPEN_PROJECT_BASE_URL is not set. Copy .env.local.example to .env.local and fill it in."
[ -n "${OPEN_PROJECT_ACCESS_TOKEN:-}" ] || die "OPEN_PROJECT_ACCESS_TOKEN is not set. Copy .env.local.example to .env.local and fill it in."

BASE_URL="${OPEN_PROJECT_BASE_URL%/}"

# Refuse anything outside the v3 API surface, and refuse a path that tries to
# escape it with a scheme, a host, or traversal.
assert_api_path() {
  case "$1" in
    /api/v3/*) ;;
    *) die "Path must start with /api/v3/ (got: $1)" ;;
  esac
  case "$1" in
    *..*) die "Path must not contain '..' (got: $1)" ;;
    *//*) die "Path must not contain '//' (got: $1)" ;;
  esac
}

assert_writable() {
  case "${OPEN_PROJECT_READONLY:-false}" in
    true|TRUE|1|yes) die "OPEN_PROJECT_READONLY is set — refusing to $1." ;;
  esac
}

# Reads the body from a literal JSON string, @file, or - for stdin.
read_body() {
  case "$1" in
    -) cat ;;
    @*) cat "${1#@}" ;;
    *) printf '%s' "$1" ;;
  esac
}

# Percent-encodes an OpenProject filters array from name/value pairs.
encode_filters() {
  python3 -c 'import json,sys,urllib.parse
pairs = sys.argv[1:]
f = [{pairs[i]: {"operator": "=", "values": [pairs[i + 1]]}} for i in range(0, len(pairs), 2)]
print(urllib.parse.quote(json.dumps(f)))' "$@"
}

# curl with auth supplied via --config on stdin so the token never hits argv.
op_curl() {
  local method="$1" path="$2" body="${3-}"
  assert_api_path "$path"
  local args=(
    --silent --show-error --fail-with-body
    --request "$method"
    --header "Accept: application/json"
  )
  if [ -n "$body" ]; then
    args+=(--header "Content-Type: application/json" --data-binary "$body")
  fi
  printf 'url = "%s"\nuser = "apikey:%s"\n' "$BASE_URL$path" "$OPEN_PROJECT_ACCESS_TOKEN" \
    | curl "${args[@]}" --config -
}

json_get() { python3 -c 'import json,sys;d=json.load(sys.stdin);[d:=d[k] for k in sys.argv[1:]];print(d)' "$@"; }

cmd="${1:-}"
[ -n "$cmd" ] || die "Usage: scripts/dev/openproject.sh <get|post|patch|wp|children|statuses|boards|sprint|status|comment> ..."
shift

case "$cmd" in
  get)
    [ $# -ge 1 ] || die "Usage: get <path>"
    op_curl GET "$1"
    ;;

  post)
    [ $# -ge 2 ] || die "Usage: post <path> <json|@file|->"
    assert_writable "POST $1"
    op_curl POST "$1" "$(read_body "$2")"
    ;;

  patch)
    [ $# -ge 2 ] || die "Usage: patch <path> <json|@file|->"
    assert_writable "PATCH $1"
    op_curl PATCH "$1" "$(read_body "$2")"
    ;;

  wp)
    [ $# -ge 1 ] || die "Usage: wp <id>"
    op_curl GET "/api/v3/work_packages/$1"
    ;;

  children)
    [ $# -ge 1 ] || die "Usage: children <id>"
    op_curl GET "/api/v3/work_packages?filters=%5B%7B%22parent%22%3A%7B%22operator%22%3A%22%3D%22%2C%22values%22%3A%5B%22$1%22%5D%7D%7D%5D&pageSize=100"
    ;;

  statuses)
    op_curl GET "/api/v3/statuses?pageSize=100" \
      | python3 -c 'import json,sys
for s in json.load(sys.stdin)["_embedded"]["elements"]:
    print("%4d  %s%s" % (s["id"], s["name"], "  (closed)" if s.get("isClosed") else ""))'
    ;;

  boards)
    op_curl GET "/api/v3/grids?pageSize=100" \
      | python3 -c 'import json,sys
for g in json.load(sys.stdin)["_embedded"]["elements"]:
    o = g.get("options") or {}
    if o.get("type") != "action":
        continue
    sprints = [v for f in o.get("filters", []) for v in f.get("sprint_id", {}).get("values", [])]
    cols = [w.get("options", {}).get("queryId") for w in g.get("widgets", [])]
    print("grid %-4s sprint %-4s %s" % (g["id"], ",".join(sprints) or "-", g.get("name")))
    print("          column queries: %s" % ", ".join(str(c) for c in cols if c))'
    ;;

  sprint)
    [ $# -ge 1 ] || die "Usage: sprint <sprint-id> [status-id]"
    if [ $# -ge 2 ]; then
      filters="$(encode_filters sprint "$1" status "$2")"
    else
      filters="$(encode_filters sprint "$1")"
    fi
    op_curl GET "/api/v3/work_packages?filters=$filters&pageSize=200" \
      | python3 -c 'import json,sys
d = json.load(sys.stdin)
print("total: %s" % d["total"])
for e in d["_embedded"]["elements"]:
    l = e["_links"]
    print("  #%-5s %-9s %-22s %-18s %s" % (
        e["id"], l["type"]["title"], l["status"]["title"],
        (l.get("assignee") or {}).get("title", "unassigned")[:18], e["subject"]))'
    ;;

  status)
    [ $# -ge 2 ] || die "Usage: status <work-package-id> <status-id>"
    assert_writable "change the status of work package $1"
    lock="$(op_curl GET "/api/v3/work_packages/$1" | json_get lockVersion)"
    op_curl PATCH "/api/v3/work_packages/$1" \
      "$(printf '{"lockVersion":%s,"_links":{"status":{"href":"/api/v3/statuses/%s"}}}' "$lock" "$2")"
    ;;

  comment)
    [ $# -ge 2 ] || die "Usage: comment <work-package-id> <text>"
    assert_writable "comment on work package $1"
    op_curl POST "/api/v3/work_packages/$1/activities" \
      "$(python3 -c 'import json,sys;print(json.dumps({"comment":{"raw":sys.argv[1]}}))' "$2")"
    ;;

  delete|DELETE|rm|destroy)
    die "This helper has no delete path. Destructive OpenProject operations are out of scope — do it in the web UI if you really mean it."
    ;;

  *)
    die "Unknown command: $cmd"
    ;;
esac
