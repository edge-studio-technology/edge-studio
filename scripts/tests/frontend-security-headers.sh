#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
base_url=${EDGE_STUDIO_BASE_URL:-"https://localhost:${FRONTEND_PORT:-8080}"}
expected_csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://raw.githubusercontent.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
temp_dir=$(mktemp -d "${TMPDIR:-/tmp}/edge-studio-security-headers.XXXXXX")

cleanup() {
  rm -rf -- "$temp_dir"
}
trap cleanup EXIT HUP INT TERM

case "$base_url" in
  https://*) base_url=${base_url%/} ;;
  *)
    echo "EDGE_STUDIO_BASE_URL must be an HTTPS origin" >&2
    exit 1
    ;;
esac

header_value() {
  header_file=$1
  header_name=$2
  awk -F: -v wanted="$header_name" '
    tolower($1) == tolower(wanted) {
      sub(/^[^:]*:[[:space:]]*/, "")
      sub(/\r$/, "")
      print
    }
  ' "$header_file"
}

assert_header() {
  header_file=$1
  label=$2
  header_name=$3
  expected_value=$4
  actual_value=$(header_value "$header_file" "$header_name")

  if [ "$actual_value" != "$expected_value" ]; then
    echo "$label: expected exactly '$header_name: $expected_value', got '$actual_value'" >&2
    exit 1
  fi
}

assert_security_headers() {
  header_file=$1
  label=$2
  assert_header "$header_file" "$label" "X-Content-Type-Options" "nosniff"
  assert_header "$header_file" "$label" "X-Frame-Options" "DENY"
  assert_header "$header_file" "$label" "Referrer-Policy" "no-referrer"
  assert_header "$header_file" "$label" "Content-Security-Policy" "$expected_csp"
}

check_https_response() {
  label=$1
  path=$2
  expected_status=$3
  header_file="$temp_dir/$label.headers"
  body_file="$temp_dir/$label.body"
  status=$(curl -k -sS --http1.1 -D "$header_file" -o "$body_file" -w '%{http_code}' "$base_url$path")

  if [ "$status" != "$expected_status" ]; then
    echo "$label: expected HTTP $expected_status, got $status" >&2
    exit 1
  fi

  assert_security_headers "$header_file" "$label"
  echo "$label: HTTP $status with the expected security headers"
}

cd "$repo_root"

check_https_response "spa" "/" "200"
check_https_response "api-health" "/api/health" "200"
check_https_response "nginx-error" "/es_logo/" "403"

redirect_headers="$temp_dir/http-redirect.headers"
docker compose exec -T frontend curl -sS --http1.1 -D - -o /dev/null \
  -w 'Edge-Studio-Curl-Status:%{http_code}\n' http://127.0.0.1/ >"$redirect_headers"
assert_header "$redirect_headers" "http-redirect" "Edge-Studio-Curl-Status" "301"
assert_security_headers "$redirect_headers" "http-redirect"
echo "http-redirect: HTTP 301 with the expected security headers"
