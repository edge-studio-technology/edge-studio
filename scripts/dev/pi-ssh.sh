#!/usr/bin/env bash
# Run a requested command on the development Pi using .env.local credentials.
set +x
set +a
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

die() { printf '%s\n' "$*" >&2; exit 1; }

[ $# -eq 1 ] || die "Usage: bash scripts/dev/pi-ssh.sh '<remote command>'"
[ -f "$REPO_ROOT/.env.local" ] || die "Create .env.local using .env.local.example and fill in PI_SSH_LOGIN and PI_SSH_PASSWORD."
# shellcheck disable=SC1091
. "$REPO_ROOT/.env.local"
export -n PI_SSH_LOGIN PI_SSH_PASSWORD

[ -n "${PI_SSH_LOGIN:-}" ] || die "PI_SSH_LOGIN is not set in .env.local."
[ -n "${PI_SSH_PASSWORD:-}" ] || die "PI_SSH_PASSWORD is not set in .env.local."
[[ "$PI_SSH_LOGIN" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]*@[a-zA-Z0-9][a-zA-Z0-9.:-]*$ ]] \
  || die "PI_SSH_LOGIN must be user@ip-address or user@hostname."
[[ "$PI_SSH_PASSWORD" != *$'\n'* && "$PI_SSH_PASSWORD" != *$'\r'* ]] \
  || die "PI_SSH_PASSWORD must be a single line."
command -v ssh >/dev/null || die "Install the OpenSSH client on this development machine."
command -v sshpass >/dev/null || die "Install sshpass on this development machine to use password authentication."

exec sshpass -d 3 ssh -T \
  -o StrictHostKeyChecking=yes \
  -o PreferredAuthentications=password \
  -o NumberOfPasswordPrompts=1 \
  -o ConnectTimeout=10 \
  -- "$PI_SSH_LOGIN" "$1" \
  3< <(printf '%s\n' "$PI_SSH_PASSWORD")
