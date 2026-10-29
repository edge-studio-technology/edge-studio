---
name: pi-ssh
description: Access this project's local Raspberry Pi over SSH using .env.local credentials when requested to inspect, troubleshoot, test, or deploy on the Pi.
---

# Pi SSH

Use `bash scripts/dev/pi-ssh.sh '<remote command>'` from the repository root for requested Pi work. The helper reads `PI_SSH_LOGIN` (`user@ip-address`) and `PI_SSH_PASSWORD` from the gitignored `.env.local` and passes the password to `sshpass` through a file descriptor.

## Setup

- Add missing entries from `.env.local.example` to `.env.local`; preserve existing credentials. Have the user fill in the password locally rather than in chat.
- Keep `.env.local` at mode `600`. It is sourced as a trusted shell file; shell-quote values, preferably with single quotes. Do not evaluate unquoted password text.
- The local development machine needs `ssh` and `sshpass`. If either is missing, report the prerequisite; do not silently install system packages.
- SSH requires an already trusted host key. If the key is unknown, have the user verify the Pi's fingerprint through a trusted channel and establish trust with an interactive `ssh user@ip-address` connection. A changed key needs investigation; never disable host-key verification or silently remove a known key.

## Usage

Start with a read-only identity check when connecting for a new task:

```bash
bash scripts/dev/pi-ssh.sh 'hostname; id; uname -m'
```

Then run commands needed for the user's requested work. Discover the remote project directory before assuming a deployment path. Quote the remote command as one local argument; shell expansion inside it happens on the Pi.

Credentials enable access; they do not authorize unrelated operations. Continue inspections and reversible fixes within the user's task. Deployments, restarts, package installs, and destructive operations must be covered by the current request or existing session authorization. Creating this skill does not authorize a deployment or reboot.

Never print, copy into tool arguments, log, or commit the password or `.env.local`. Do not use `sshpass -p`, dump the remote environment, or request secret-bearing logs/configuration without redaction. Do not forward the password to `sudo`; SSH and privilege escalation are separate.

On an authentication or host-key failure, report it and stop retries until the configuration or trust issue is resolved. Report what was checked or changed on the Pi and any verification that remains incomplete.
