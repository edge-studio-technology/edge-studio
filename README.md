# Edge Studio

Edge Studio is a learning prototype for a Raspberry Pi application that can be installed with one command, started with Docker Compose, and opened from a browser on the local network.

The current prototype contains:

- A GitHub-based installer: `install.sh`
- A Docker Compose application
- A React frontend on port `8080`
- A TypeScript/Express backend
- A Minima node container
- Integritas stamping and verification proxy endpoints
- Data source read history with links to automated Integritas stamps
- SQLite persistence for local settings
- Read-only file browsing for a configured host directory
- A simple architecture that can grow with more services later

## Installation On Raspberry Pi

Run:

```bash
curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/install.sh | sudo bash
```

To install from a branch before it is merged to `main`, pass `APP_BRANCH`:

```bash
curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/install.sh | sudo env APP_BRANCH=<branch-name> bash
```

To enable Raspberry Pi GPIO input sources during install, pass `ENABLE_GPIO=true`:

```bash
curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/install.sh | sudo env ENABLE_GPIO=true bash
```

`ENABLE_GPIO=true` writes `/opt/edge-studio/docker-compose.override.yml` with `/dev/gpiochip0` mounted into the backend container and detects the host GPIO group id. Leave it disabled unless this deployment needs GPIO hardware ingestion.

To enable Raspberry Pi camera capture devices during install, pass `ENABLE_CAMERA=true`:

```bash
curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/install.sh | sudo env ENABLE_CAMERA=true bash
```

`ENABLE_CAMERA=true` installs and starts a host-side `edge-studio-camera-helper` systemd service, generates a `CAMERA_HELPER_TOKEN`, and writes backend configuration so the Docker backend can call the helper through the fixed Edge Studio Compose gateway. Leave it disabled unless this deployment needs camera capture workflows.

`ENABLE_CAMERA=true` does not install host camera drivers or enable the Raspberry Pi camera stack. Before using camera workflows, verify the Pi host can see the camera with `libcamera-still --list-cameras` or `rpicam-still --list-cameras`. Camera Module 3 (`imx708`) requires a host OS/kernel/libcamera stack that supports it. The helper uses the host camera tools, not camera binaries inside the backend container.

To enable BME280/BME680 I2C environmental sensor devices during install, pass `ENABLE_SENSORS=true`:

```bash
curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/install.sh | sudo env ENABLE_SENSORS=true bash
```

`ENABLE_SENSORS=true` installs and starts a host-side `edge-studio-sensor-helper` systemd service, generates a `SENSOR_HELPER_TOKEN`, and writes backend configuration so the Docker backend can call the helper through the fixed Edge Studio Compose gateway. Leave it disabled unless this deployment needs direct I2C sensor reads. The Pi's I2C interface must also be enabled on the host. BME680 reads require the Python `bme680` module; the installer creates a dedicated sensor-helper virtualenv and installs the module there when sensor support is enabled.

To enable the optional local MQTT broker during install, pass `ENABLE_MQTT_BROKER=true`:

```bash
curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/install.sh | sudo env ENABLE_MQTT_BROKER=true bash
```

The broker is exposed on `${MQTT_PUBLIC_PORT:-1883}` for trusted LAN devices and is available to backend containers as `mqtt://mqtt:1883`. It is disabled by default.

The installer will:

- Check that it runs as root or through `sudo`
- Check that the machine is Linux
- Warn if the architecture does not look like Raspberry Pi/ARM
- Install required host packages
- Install Docker if Docker is missing
- Verify Docker Compose
- Download the default runtime bundle to `/opt/edge-studio` or clone the repository when `DEV_MODE=true`
- Write `/opt/edge-studio/.env`
- Generate a self-signed TLS certificate in `DATA_DIR/certs`
- Start the app with `docker compose up -d --build`

Open the UI at:

```txt
https://<pi-ip>:8080
```

Or locally on the Pi:

```txt
https://localhost:8080
```

Your browser will warn about the self-signed certificate. That is expected — choose Advanced / Continue. Traffic is encrypted after that.

## Configuration

Runtime configuration is stored in `.env`:

```env
HOST_FILES_DIR=/home/pi
FRONTEND_PORT=8080
TZ=UTC
DATA_DIR=./data
APP_SECRET=dev-change-me
DOCKER_GID=0
ENABLE_GPIO=false
GPIO_GID=0
ENABLE_CAMERA=false
CAMERA_CAPTURE_DIR=/data/captures
CAMERA_HELPER_URL=http://172.30.0.1:38180
CAMERA_HELPER_TOKEN=
CAMERA_HELPER_PORT=38180
CAMERA_MAX_DURATION_SECONDS=30
CAMERA_RETENTION_DAYS=7
CAMERA_PHOTO_COMMAND=rpicam-still
CAMERA_VIDEO_COMMAND=rpicam-vid
ENABLE_SENSORS=false
SENSOR_HELPER_URL=http://172.30.0.1:38181
SENSOR_HELPER_TOKEN=
SENSOR_HELPER_PORT=38181
SENSOR_READ_TIMEOUT_MS=5000
INTEGRITAS_DOCKER_SUBNET=172.30.0.0/24
INTEGRITAS_DOCKER_GATEWAY=172.30.0.1
ENABLE_MQTT_BROKER=false
COMPOSE_PROFILES=
MQTT_PUBLIC_HOST=
MQTT_PUBLIC_PORT=1883
MQTT_INTERNAL_URL=mqtt://mqtt:1883
MINIMA_DATA_DIR=./minima
MINIMA_BACKUP_DIR=./minima-backup
MINIMA_P2P_PORT=9003
MINIMA_RPC_BIND=127.0.0.1
MINIMA_RPC_PORT=9005
MINIMA_HEALTH_POLL_INTERVAL_SECONDS=60
MINIMA_STALL_BLOCK_AGE_SECONDS=300
MINIMA_AUTO_RESYNC=false
MINIMA_AUTO_RESYNC_COOLDOWN_MINUTES=30
INTEGRITAS_CONNECT_BASE_URL=https://integritas.technology
INTEGRITAS_BASE_URL=https://integritas.technology/core
INTEGRITAS_REQUEST_ID=edge-studio
INTEGRITAS_REQUEST_TIMEOUT_MS=15000
INTEGRITAS_POLL_INTERVAL_SECONDS=30
INTEGRITAS_PROOF_POLL_TIMEOUT_MINUTES=5
INTEGRITAS_DEVICE_POLL_INTERVAL_SECONDS=5
INTEGRITAS_PORTAL_URL=
COOKIE_SECURE=true
SESSION_MAX_AGE_DAYS=7
SESSION_IDLE_HOURS=24
MANIFEST_URL=
RELEASE_CHANNEL=stable
UPDATE_HEALTH_CHECK_TIMEOUT_MS=60000
UPDATE_HEALTH_CHECK_INTERVAL_MS=2000
UPDATE_PULL_TIMEOUT_MS=300000
UPDATE_AGENT_STATE_DIR=./update-agent-state
```

The installer sets `COOKIE_SECURE=true` for the default HTTPS Docker deploy. Use `COOKIE_SECURE=false` only for native `npm run dev` (HTTP on port 5173).

`HOST_FILES_DIR` is mounted into the backend container as `/host-files:ro`. The `:ro` flag is intentional for this prototype.

`TZ` sets the backend container's timezone (default `UTC`). Set it to the Pi's real local timezone (e.g. `Europe/Amsterdam`) so the nightly Minima auto-backup (00:30) lands at actual local night.

`MINIMA_DATA_DIR` is mounted into the Minima container as `/home/minima/data` so node data survives container restarts and updates. `MINIMA_BACKUP_DIR` is a separate host path `update-agent` copies that data into before a Minima update, and restores from if the update fails its health check. `UPDATE_AGENT_STATE_DIR` persists `update-agent`'s own bookkeeping (the last successfully applied manifest's timestamp and version, used to reject replayed/downgraded manifests) across container restarts. `install.sh` also writes an initial `last-applied-manifest.json` there at install time, and it's mounted read-only into the backend container (`/update-agent-state`) as the single source of truth for the app version shown in feedback submissions, falling back to `package.json`'s version only if that file isn't present yet (e.g. native dev).

`MINIMA_RPC_BIND` defaults to `127.0.0.1`, which means Minima RPC is only exposed on the Pi itself. Set it to `0.0.0.0` only on a trusted network.

The backend runs a Minima health poller on `MINIMA_HEALTH_POLL_INTERVAL_SECONDS` (default 60s). It detects chain stalls when the last block age exceeds `MINIMA_STALL_BLOCK_AGE_SECONDS` (default 300s) while the node is running. Optional auto-resync is **off by default**; set `MINIMA_AUTO_RESYNC=true` to allow the poller to call Megammr resync (see `SECURITY.md`).

`DATA_DIR` is mounted into the backend container as `/data` and stores the SQLite database.

`APP_SECRET` is used by the backend to encrypt local secrets before storing them in SQLite. The installer generates this automatically and preserves it on updates. If it changes, previously encrypted secrets cannot be decrypted.

`DOCKER_GID` lets the non-root backend user read Docker status through `/var/run/docker.sock`. The installer detects this automatically from the socket group id.

`ENABLE_GPIO=true` lets the installer create a Docker Compose override that mounts `/dev/gpiochip0` for GPIO input sources. `GPIO_GID` is detected from `/dev/gpiochip0` or the host `gpio` group when possible. GPIO stays disabled by default because it grants the backend container host hardware access.

When GPIO is not enabled or `/dev/gpiochip0` is unavailable in the backend container, the GPIO Input and PIR Motion Sensor cards are disabled in the Data Sources page.

GPIO input/output settings for tested button, LED, and HC-SR501 PIR motion sensor wiring, plus suggested untested device profiles, are documented in [`docs/guides/gpio-device-settings.md`](./docs/guides/gpio-device-settings.md).

`ENABLE_CAMERA=true` lets the installer create a host-side Python camera helper service. The Devices page enables the Pi Camera capture device type only when the helper reports usable host camera commands and at least one detected camera. Camera support stays disabled by default because it grants the app a way to trigger host camera capture and captured images/video may contain private data.

Pi Camera devices are capture/input devices, not generic output targets. Automation workflows use a `Capture camera` data block to capture a photo or short video clip, hash the captured media bytes, store capture metadata in read history, and optionally attach `Stamp data` to create an Integritas proof for the media hash. Captured media is stored locally under `CAMERA_CAPTURE_DIR` (`/data/captures` in Docker, mapped to the host data directory for the helper). `CAMERA_MAX_DURATION_SECONDS` limits per-capture video duration. `CAMERA_PHOTO_COMMAND` and `CAMERA_VIDEO_COMMAND` default to `rpicam-still` and `rpicam-vid`; the Python helper also falls back to `libcamera-still` and `libcamera-vid`. `INTEGRITAS_DOCKER_SUBNET` and `INTEGRITAS_DOCKER_GATEWAY` pin the Compose network so the backend has a stable route to the host helper after reboot/redeploy. The helper uses only Python's standard library and is intended as the extension point for future USB/RTSP/HTTP camera backends.

`ENABLE_SENSORS=true` lets the installer create a host-side Python sensor helper service for direct I2C sensor reads. The Devices page includes `BME280 Environmental Sensor` and `BME680 Environmental Sensor` templates. BME sensor devices are readable input sources: manual reads and Automation `Fetch data source` blocks produce JSON with `temperatureC`, `humidityPercent`, `pressureHpa`, I2C bus/address, and `readAt`, then hash that JSON for Integritas stamping. Wire the module's `VIN` to 3.3V or 5V, `GND` to ground, `SCL` to physical pin 5 / GPIO3, and `SDA` to physical pin 3 / GPIO2. Enable I2C on the Pi host first, and use address `0x76` or `0x77` depending on the module. BME680 reads require the Python `bme680` module in the sensor-helper virtualenv. See [`docs/guides/bme280-sensor.md`](./docs/guides/bme280-sensor.md) for setup details.

`INTEGRITAS_CONNECT_BASE_URL` is the Integritas Connect host used for device activation and account linking (default `https://integritas.technology`).

`INTEGRITAS_BASE_URL` is the Integritas core host used for proof stamping (default `https://integritas.technology/core`).

Proof stamping uses the Integritas Connect account API key stored encrypted in `integritas_auth.api_key_enc` after device linking. Link Integritas Connect from the Integritas page or during first-run setup. API keys are never exposed in the frontend bundle.

`INTEGRITAS_DEVICE_POLL_INTERVAL_SECONDS` is how often the Pi polls Connect while device activation is pending (default `5`).
`ENABLE_MQTT_BROKER=true` enables the optional local Mosquitto broker when `COMPOSE_PROFILES=mqtt` is also set. The installer sets both values when launched with `ENABLE_MQTT_BROKER=true`. The Devices page shows the LAN broker URL for external devices and the internal Docker URL for Edge Studio MQTT input/output configs.

The ESP32 MQTT Board onboarding option creates a normal MQTT input source and then shows copyable Arduino ESP32 starter firmware. The generated firmware uses the LAN broker host/port for the ESP32 while the saved MQTT source can keep using the backend's internal broker URL.

Step-by-step ESP32 flashing and workflow setup instructions are in [`docs/guides/esp32-mqtt-sensors.md`](./docs/guides/esp32-mqtt-sensors.md).

The backend polls Integritas for pending proof UIDs in the background (`INTEGRITAS_POLL_INTERVAL_SECONDS`, default 30). Pending proofs that never reach on-chain status are marked failed after `INTEGRITAS_PROOF_POLL_TIMEOUT_MINUTES` (default 5). Automation workflows retry Integritas stamps on the next run after transient upstream errors. Manual poll in Diagnostics still works and uses the same refresh logic.

On the Integritas page, stamping a file opens a result modal with proof UID, hash, and on-chain status (with optional live status refresh). The Configure Integritas modal links to the cloud portal API logs tab (`INTEGRITAS_PORTAL_URL`, default `https://integritas.technology/profile?tab=apilogs`).

The Minima page also stores its Megammr host URL in SQLite through the Configure Minima modal. If no value has been saved, it defaults to `megammr.minima.global:9001`.

The Minima page exposes an allowlisted Megammr resync action. The browser calls the backend, and the backend calls Minima RPC internally with `megammrsync action:resync host:<configured-megammr-host>`.

Restarting the Minima node from the UI shuts it down gracefully first: the backend sends `quit compact:true` over RPC and waits (up to 5 minutes — the node can take a while to actually stop even after reporting shutdown complete) for the container to actually exit before starting it back up, instead of immediately force-stopping it. If the node still hasn't stopped after that, it falls back to a forceful container restart so the action still always completes.

An optional "Auto restart" toggle (off by default) has the backend perform this same graceful restart automatically every 48 hours, as a preventive node health measure. It reuses the nightly auto-backup scheduler rather than a separate timer, so the check runs at 00:30 on the backend container's clock, after that night's backup — it only actually restarts every other night, tracked by a persisted last-run time so a backend redeploy doesn't reset the cadence.

The Minima page also exposes node backup & restore, a fuller recovery mechanism than the Wallet page's seed-phrase import below: a Minima `backup` includes the seed phrase, private keys, coin proofs, key-use counters, and transaction history, not just spendable wallet keys. Backups are written by Minima into `${MINIMA_DATA_DIR}/backups` on the host — mounted into `minima` at `/home/minima/backups` (Minima resolves the `backup`/`restoresync` `file:` argument against its home dir, not `/home/minima/data`) and into `backend` read-write at `/minima-backups`, the only host directory shared between the two containers — so the UI can list, download, upload, and delete backup files. An admin sets one backup password once (re-auth required, stored encrypted); every backup from then on, manual or automatic, uses that same password, so there's no unencrypted/weakly-protected class of backup at all. Backups are tracked in a single list capped at 20, oldest auto-deleted — all downloadable and restorable. Restoring always uses Minima's `restoresync`, which restores the backup and re-syncs from the configured Megammr host in one step; restoring one of these tracked backups needs no password re-entry, since the backend already knows the stored password. Automatic backups are created by the backend's own scheduler at a fixed nightly time, 00:30 on the backend container's clock (not Minima's built-in `backup auto:true`, which can never be given a custom password or write anywhere the backend can see) — set the `TZ` environment variable to the Pi's real local timezone (default `UTC`) so this lands at actual local night. Downloading, restoring, or changing the backup password all require re-entering the current admin PIN/password.

The Wallet page exposes allowlisted wallet/account actions through the backend:

- global balance via Minima `balance` (`GET /api/wallet`)
- labeled accounts mapped to the node's 64-address pool (`GET/POST /api/wallet/accounts`)
- per-account holdings via Minima `coins relevant:true`
- send history in SQLite (`GET /api/wallet/history`)
- payment submission via Minima `send` (`POST /api/wallet/send-payment`)
- seed phrase import via Minima `restore` (`POST /api/wallet/import`)

`POST /api/wallet/accounts` with `{ label }` creates a named account on a random default address. With `{ label, address }` it labels an existing funded address (migration/recovery). This does not create new seed material.

`GET /api/wallet/accounts` returns labeled accounts with per-address MINIMA/token balances plus `unlabeledFunded` addresses that have funds but no label yet.

Dev-only debug routes (`POST /api/wallet/debug/clear-wallet-accounts`, `clear-wallet-history`) clear SQLite wallet tables for local testing; they return 403 when `NODE_ENV=production`.

Minima RPC commands should be transmitted as a single percent-encoded URL path command, not as query parameters. For example:

```txt
http://minima:9005/megammrsync%20action%3Aresync%20host%3Amegammr.minima.global%3A9001
```

`COOKIE_SECURE` controls the session cookie `Secure` flag. The Docker deploy uses HTTPS with `COOKIE_SECURE=true` (`https://<pi-ip>:8080`). Native dev uses HTTP on `http://localhost:5173` with `COOKIE_SECURE=false`.

TLS certificates are stored in `DATA_DIR/certs` (`server.crt`, `server.key`). The installer generates them automatically. To regenerate after a Pi IP change:

```bash
cd /opt/edge-studio
INTEGRITAS_TLS_FORCE=1 bash scripts/generate-tls-cert.sh
docker compose -f docker-compose.yml -f docker-compose.release.yml up -d frontend
```

Future versions may support custom certificates or an external reverse proxy.

`SESSION_MAX_AGE_DAYS` and `SESSION_IDLE_HOURS` control session lifetime (default 7 days max, 24 hours idle).

`MANIFEST_URL` configures the `update-agent` service: the signed update manifest URL, served from `edgestudio.technology` by default. If that fetch fails, `update-agent` automatically falls back to the public [edge-studio-manifests](https://github.com/edge-studio-technology/edge-studio-manifests) GitHub repo via `raw.githubusercontent.com` (not configurable). The Ed25519 public key used to verify its signature is baked into the `update-agent` image at build time from the committed `update-agent/manifest-public-key.pem`, not an env var. Leave `MANIFEST_URL` empty to disable update checks. The update flow is split across two origins-in-one: `https://<pi-ip>:8080/update` (no trailing slash) is the product frontend's own page — checks for updates and starts one; `https://<pi-ip>:8080/update/` (trailing slash) is `update-agent`'s own static page — shows apply progress and survives a frontend container swap mid-update. Both are the same TLS cert/origin, proxied through `frontend`'s nginx (no extra browser approval). See [.agents/rules/update-agent.md](.agents/rules/update-agent.md) for the full design.

Default installs use `docker-compose.yml` plus `docker-compose.release.yml`, which removes source build contexts and uses the signed manifest's image digests. `DEV_MODE=true` installs use only `docker-compose.yml` so frontend/backend can be built from source.

The default-install runtime bundle is intentionally limited to the files listed in `scripts/release/runtime-bundle-files.json`; source-build directories such as `frontend/`, `backend/`, and `update-agent/` are only required for `DEV_MODE=true` installs.

Build the default-install runtime archive with `npm run release:build-runtime-bundle`; it writes `edge-studio-runtime.tar.gz` from the allowlisted files. The installer derives `RUNTIME_BUNDLE_URL` from `MANIFEST_URL` unless explicitly overridden.

To install with another file root or port:

```bash
curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/install.sh | sudo HOST_FILES_DIR=/home/pi/Documents FRONTEND_PORT=8081 bash
```

## Local Development

Copy the example environment file:

```bash
cp .env.example .env
```

For local development on a non-Pi machine, change `HOST_FILES_DIR` to a directory that exists on your machine.

### Native frontend + backend (fast iteration)

Use this when you want to change UI or API code without rebuilding Docker images.

Start both servers from the repo root:

```bash
npm install
npm run dev
```

That runs the backend API on port 3000 and the Vite dev server on port 5173 (which proxies `/api` to the backend). You can also run them separately with `npm run dev:backend` and `npm run dev:frontend` in two terminals.

Open:

```txt
http://localhost:5173
```

### HTTPS dev (matches Docker self-signed behavior)

To test secure cookies and HTTPS-only browser APIs during native dev:

```bash
npm run dev:https
```

Open `https://localhost:5173` and accept the self-signed certificate warning (same certs as `scripts/generate-tls-cert.sh` / Docker). The backend runs with `COOKIE_SECURE=true`.

Plain `npm run dev` stays on HTTP for fast iteration.

The backend loads the repo-root `.env` automatically in dev. `DATABASE_PATH`, `DATA_DIR`, and `HOST_FILES_DIR` are resolved relative to the repo root.

Frontend styling direction: component and page styling should use Tailwind utilities. Existing component-level CSS is being migrated to Tailwind as a dedicated cleanup effort; after migration, plain CSS should be limited to root/body/base global rules only.

Transient frontend errors should use the shared toast system (`ToastProvider` / `useToast`) instead of duplicating inline messages across modals and pages. Keep inline errors for form validation, row-level status, and persistent context-specific details.

Optional: run Minima in Docker while developing natively:

```bash
docker compose up -d minima
```

Without Minima, the rest of the app still works; the status overview will report Minima as unavailable.

Optional: run `backend` and `update-agent` in Docker while the frontend runs natively with hot reload (e.g. `npm run dev:frontend` alone, pointed at an otherwise-Dockerized stack). Vite's dev proxy forwards `/api` to `http://localhost:3000` and `/update/...` (trailing slash and deeper — status/apply checks and update-agent's own progress page; bare `/update` stays the SPA's own route) to `http://localhost:8081`, so those container ports need to be published to the host. Create a gitignored `docker-compose.override.yml` in the repo root (Compose loads it automatically, and `install.sh` deletes/regenerates its own copy on every install, so a local one here never affects a deployed Pi):

```yaml
services:
  backend:
    ports:
      - "3000:3000"
  update-agent:
    ports:
      - "8081:8081"
```

Then start the Dockerized services:

```bash
docker compose --profile update-agent up -d backend minima update-agent
```

In dev, `update-agent` almost always reports an update as available, since locally built images never match a real signed manifest's digests — that's expected, and useful: it means the Update page/flow is always testable. To exercise the flow without actually pulling or swapping any container, set `UPDATE_DRY_RUN=true` in `.env` (dev only — never set this in production, see `SECURITY.md`) before starting `update-agent`. A dry-run apply still goes through the normal running → succeeded flow but never marks the manifest as applied, so "update available" keeps showing for repeat testing.

### Full stack in Docker

Generate a TLS certificate (once per machine, or after a LAN IP change):

```bash
bash scripts/generate-tls-cert.sh
```

Start everything:

```bash
docker compose up -d --build
```

Open:

```txt
https://localhost:8080
```

Accept the browser warning for the self-signed certificate.

View logs:

```bash
docker compose logs -f
```

## Authentication

On first launch with an empty database, Edge Studio shows a setup wizard:

1. Choose a local admin credential: a 6-digit PIN or a password with at least 8 characters, including uppercase, lowercase, a number, and a symbol
2. Create or connect the Integritas Connect account used for plan and proof usage
3. Review the connected account and finish setup

After setup, sign in with the chosen PIN or password. You can switch credential types later in Settings. There is a single local admin account (no username to enter), and only its bcrypt hash is stored. Sessions persist across browser reloads until logout or expiry.

TOTP is temporarily disabled through `TOTP_ENABLED = false` in the backend and frontend auth constants.

Public API routes (no session required):

- `GET /api/health`
- `GET /api/setup/status`
- `POST /api/setup/*`
- `POST /api/auth/login`

All other `/api/*` routes require a valid session cookie.

## Feedback

Authenticated users can open the Feedback modal from the app shell sidebar. Feedback is submitted to Integritas with the existing backend-only Integritas API key and per-submission consent. The browser never receives the API key.

Feedback is also saved locally on the Pi as one hidden aggregate JSON fallback file:

```txt
DATA_DIR/feedback/feedback-submissions.json
```

In the default Docker deploy this is inside the backend container at `/data/feedback/feedback-submissions.json` and on the host under the configured `DATA_DIR`.

Feedback includes the current page, feedback area, feedback type, optional bug/feature details, description, browser context, non-secret app/user/device metadata, current Node/Integritas connection status, and lightweight app stats. It must not include passwords, TOTP secrets, session cookies, Integritas API keys, wallet seed phrases, or raw encrypted secret values.

Edge Studio saves feedback locally first, then sends the single new submission to `https://integritas.technology/api/feedback`. The modal requires per-submission consent before sending device metadata, browser context, and non-secret usage stats off the Pi.

If the Integritas API key is missing or the hosted endpoint is unavailable, the local JSON file remains the durable fallback. Retrying is safe because each submission keeps its Pi-generated id.

The CLI does not send session cookies in V1. Operational CLI commands that call protected APIs return `401 Unauthorized` until a future CLI auth story is added. Use the browser UI for authenticated operations.

## CLI

The browser UI and CLI both call the same backend API. The backend does not run arbitrary shell commands, and the CLI does not duplicate business logic.

After installation, the CLI is available on the Pi as:

```bash
edge-studio --help
```

Operational V1 commands:

```bash
edge-studio status
edge-studio doctor
edge-studio logs backend
edge-studio data-sources list
edge-studio data-sources read <id>
edge-studio automation list
edge-studio automation run <id>
edge-studio automation pause <id>
edge-studio automation enable <id>
edge-studio integritas history
```

By default the CLI calls:

```txt
https://localhost:8080/api
```

Override it when calling a remote Pi:

```bash
EDGE_STUDIO_API_URL=https://<pi-ip>:8080/api edge-studio status
```

The CLI uses `curl -k` because the default deploy uses a self-signed certificate.

Run checks before pushing or installing on a Pi:

```bash
npm run check
docker compose build --no-cache
```

`npm run check` runs backend and frontend TypeScript checks plus moderate-level npm audits. `docker compose build --no-cache` catches Docker build issues from a clean image context.

## Troubleshooting

If the UI shows `Backend health error: HTTP 502`, check backend logs:

```bash
sudo docker compose -f /opt/edge-studio/docker-compose.yml -f /opt/edge-studio/docker-compose.release.yml --project-directory /opt/edge-studio logs --tail=100 backend
```

If logs contain `SqliteError: unable to open database file`, fix the SQLite data directory permissions:

```bash
sudo mkdir -p /opt/edge-studio/data
sudo chown -R 1000:1000 /opt/edge-studio/data
sudo chmod 700 /opt/edge-studio/data
sudo docker compose -f /opt/edge-studio/docker-compose.yml -f /opt/edge-studio/docker-compose.release.yml --project-directory /opt/edge-studio restart backend
```

The backend container runs as the non-root `node` user, which uses uid `1000`. That user must be able to write to the mounted SQLite data directory.

## Stop The App

On the Pi:

```bash
cd /opt/edge-studio
docker compose down
```

## Reset The Database

To wipe an installed app's entire SQLite database (all users, sessions, Integritas history, data sources, and automation workflows), run:

```bash
curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/scripts/dev/clear-db.sh | sudo bash
```

It stops the `backend` container, deletes `edge-studio.db` from the app's data directory, then restarts `backend` so migrations recreate a fresh schema. You'll be prompted to confirm before anything is deleted.

To clear only part of the database instead, set `TARGET`:

```bash
# Local accounts, sessions, setup wizard state, and Integritas Connect pairing.
# Forces redoing the setup wizard and Integritas Connect.
curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/scripts/dev/clear-db.sh | sudo TARGET=users bash

# Integritas proof history, data source read history, and automation workflow
# run logs (the Diagnostics tabs). Leaves accounts, data sources, and workflow
# definitions untouched.
curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/scripts/dev/clear-db.sh | sudo TARGET=history bash

# Data sources and automation workflows/blocks. Leaves accounts and history untouched.
curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/scripts/dev/clear-db.sh | sudo TARGET=automation bash
```

`TARGET` defaults to `all` (the full database-file wipe above); the scoped targets run SQL deletes against just those tables using the already-built `backend` image, instead of deleting the whole file.

If the app is installed somewhere other than the default `/opt/edge-studio`, set `APP_DIR`:

```bash
curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/scripts/dev/clear-db.sh | sudo APP_DIR=/opt/edge-studio bash
```

## Tune Update Agent Poll Interval

`update-agent` checks the update manifest in the background every 30 minutes by default (`STATUS_POLL_INTERVAL_MS=1800000`). To lower this on an installed app, for example for QA/testing:

```bash
curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/scripts/dev/set-status-poll-interval.sh | sudo STATUS_POLL_INTERVAL_MS=300000 bash
```

It updates only that one line in the app's `.env`, leaving every other value untouched, then recreates the `update-agent` container to apply it -- only if `update-agent` is already running, so this never starts it on installs that leave it off (e.g. `DEV_MODE`). Set `APP_DIR` the same way as above if the app isn't installed at `/opt/edge-studio`.

## Update The App

Run the installer again:

```bash
curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/install.sh | sudo bash
```

The installer preserves the existing `.env` file, SQLite data directory, and Minima data directory, then pulls the latest repository contents and recreates the containers.

You can override the branch:

```bash
curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/install.sh | sudo APP_BRANCH=main bash
```

## Architecture

```txt
Browser
  |
  | https://<pi-ip>:8080
  v
frontend container
  - React static app
  - Nginx
  - Proxies /api to backend:3000
  - Sidebar pages: App status, Minima, Integritas, File explorer
  |
  v
backend container
  - Express + TypeScript
  - SQLite database at /data/edge-studio.db
  - GET /api/health
  - GET /api/status/overview
  - GET /api/files
  - GET /api/minima/status
- Integritas hash, stamp, status, verify endpoints
- Device APIs and historic read log at `/api/data-sources` and `/api/data-reads`
  - Input sources can include an optional health status URL. The browser polls saved health URLs once per minute through the backend and shows the latest status in the configured devices table.
  - Device protocols currently include HTTP JSON API fetches, BME280/BME680 I2C sensor reads, webhook JSON receives, MQTT JSON subscriptions, Raspberry Pi GPIO input events, HC-SR501-style PIR motion events, and Raspberry Pi GPIO LED output targets. Devices define connection details; Automation workflows decide whether reads are recorded, outputs are controlled, and hashes are stamped. GPIO LED output targets can also be test-pulsed from the Devices page before adding them to a workflow.
  - Event-driven workflow start blocks support a cooldown between runs. GPIO starts can also ignore inactive edges, which is recommended for PIR motion workflows so `motion_cleared` does not trigger notifications or output actions.
  - Automation workflows are block-based. Start blocks trigger ordered action blocks; logic blocks can stop the remaining flow when selected trigger or data fields do not match; Integritas stamping is attached as a side block to record/fetch data blocks so it stamps that block's hash without becoming the final step in the main flow. Attached stamp blocks can also have their own field condition against the trigger event or recorded/fetched data. New workflow creation uses a Scratch-inspired draft workspace with a clean Start/Data/Logic/Action block library, a visual block-chain canvas, setup inspector, and backend-powered inline validation. The draft starts empty, requires one start block first, hides start blocks after selection, and uses Reset canvas when the operator wants a different trigger. Create/edit/watch workspaces are URL-driven (`/workflows/new`, `/workflows/:id/edit`, `/workflows/:id/watch`) and render in the page rather than opening workflow editing in a modal. Build, Edit, and Watch share one workspace shell and normalized canvas renderer. Canvas blocks show validation error/warning badges in Build/Edit and selected run status/duration in Watch. Edit mode shares the builder shell, categorized block library, selected-block inspector pattern, workflow name editing, and right-side validation placement; Watch mode owns run controls, test payload execution, selected-block runtime output/error/timing, read/proof Diagnostics links, and a historic run picker that visualizes selected runs on the canvas. Draft action blocks include Pulse output and Send transaction; Integritas stamps attach as side blocks on Record/Fetch data blocks. Templates are intentionally deferred until the basic block building experience is complete. Block edits are saved per block with visible unsaved/saved feedback; add/remove/move/pause/enable actions apply immediately. Workflow validation flags broken block chains, missing devices, output/transaction risks, and missing Integritas key setup before manual runs; validation errors block `Run now` / `Run with payload`, while warnings stay visible for operator review. Workflow logs show the run trigger plus block outputs, and fetch/record blocks link their stored read preview so operators can see the JSON that conditions evaluated. Workflow lists support search, status filters, duplicate, archive, restore, and delete; archived workflows do not run automatically or manually until restored. Automation can also send native MINIMA (`0x00`) transactions to saved address book recipients through an allowlisted Send transaction block. Prototype workflows created with older equals-only condition configs should be recreated.
  - HTTP and BME sensor Fetch data blocks poll/read on workflow runs. Webhook Collect data rules record pushed JSON at generated `/api/data-source-webhooks/:token` URLs while enabled. MQTT Collect data rules subscribe to the configured broker/topic only while enabled. GPIO Collect data rules watch configured BCM pins only while enabled.
  - Reads /host-files only
  - Reads Minima status from http://minima:9005/status
  - Calls https://integritas.technology/core with the backend-only Connect API key
  - Reads Docker resource usage through /var/run/docker.sock

minima container
  - minimaglobal/minima:dev
  - P2P port ${MINIMA_P2P_PORT:-9003}
  - RPC port ${MINIMA_RPC_PORT:-9005}
  - Persistent data in ${MINIMA_DATA_DIR:-./minima}
  |
  v
Pi host filesystem
  - ${HOST_FILES_DIR:-/home/pi} mounted read-only
  - ./data mounted read-write for SQLite
  - ./minima mounted read-write for Minima data
```

The backend never receives permission to run arbitrary shell commands. It only lists files and directories under `/host-files`.

## Backend API

Health:

```http
GET /api/health
GET /api/status/overview
```

Feedback:

```http
POST /api/feedback
GET /api/feedback/config
POST /api/feedback/retry-pending
GET /api/feedback/export
```

`POST /api/feedback` appends a submission to the local aggregate JSON feedback export and sends that single submission to the hosted Integritas feedback endpoint when an API key is configured. `GET /api/feedback/config` returns non-secret hosted feedback state, `POST /api/feedback/retry-pending` retries pending or failed hosted uploads for admins, and `GET /api/feedback/export` downloads the hidden local fallback file.

`/api/status/overview` returns status for the frontend, backend, Minima node, and Integritas API, plus Docker container CPU/memory/image-size data when the Docker socket is available.

Files:

```http
GET /api/files
GET /api/files?path=/Documents
```

Example response:

```json
{
  "path": "/Documents",
  "items": [
    {
      "name": "test.txt",
      "type": "file",
      "size": 1234
    },
    {
      "name": "Pictures",
      "type": "directory"
    }
  ]
}
```

Path traversal attempts such as `../../etc/passwd` are blocked because the backend resolves the requested path and verifies that it remains inside `/host-files`.

Minima status:

```http
GET /api/minima/status
```

The backend combines Minima RPC (`http://minima:9005/status`, optional `peers`), Docker container stats for the `minima` service, and saved Megammr config into a normalized JSON response (`state`, `sync`, `health`, `container`, `storage`). Returns HTTP `200` when the check completed, even if the node is stopped or unhealthy; `502` is reserved for handler failures.

Example fields:

```json
{
  "checkedAt": "2026-06-11T12:00:00.000Z",
  "state": "running",
  "sync": { "status": "active", "block": 932067, "blockAgeSeconds": 45 },
  "health": { "peerCount": 12 },
  "container": {
    "state": "running",
    "cpuPercent": 2.5,
    "memory": { "usage": "512 MB", "limit": "4 GB" }
  },
  "monitoring": { "stallDetected": false, "autoResyncEnabled": false }
}
```

The frontend reads `/api/minima/status`, so the browser does not need direct access to Minima RPC.

Minima restart and peers (admin mutations require an admin session):

```http
POST /api/minima/restart
GET /api/minima/restart/auto
POST /api/minima/restart/auto
GET /api/minima/peers
POST /api/minima/peers/add
```

`POST /api/minima/restart` restarts the Minima Docker container via the backend Docker socket (see `SECURITY.md`). `GET`/`POST /api/minima/restart/auto` read/toggle the opt-in automatic restart (every 48 hours, checked on the same nightly scheduler tick as auto-backup — see above); `POST` accepts `{ "enabled": boolean }`. `POST /api/minima/peers/add` accepts `{ "peerslist": "host:port" }` or comma-separated addresses and calls Minima `peers action:addpeers`.

Minima RPC console (admin session required for all three):

```http
GET /api/minima/console/whitelist
POST /api/minima/console/whitelist
POST /api/minima/console/run
```

The RPC console on the Minima Core page runs a typed Minima RPC command string only if it is both in the backend's static command catalog and enabled in the admin whitelist — it is not a generic RPC proxy (see `.agents/rules/minima.md` and `docs/security/host-and-infrastructure.md`). `GET /api/minima/console/whitelist` returns the catalog and currently enabled command keys. `POST /api/minima/console/whitelist` accepts `{ "enabledKeys": string[], "currentPassword": string }` and requires re-entering the admin PIN/password, same as changing the admin credential. `POST /api/minima/console/run` accepts `{ "command": string }` (the exact RPC command text, e.g. `status` or `peers action:addpeers peerslist:host:port`) and returns the RPC/action result.

Minima node backup & restore (admin session required for all routes):

```http
GET /api/minima/backups
POST /api/minima/backups
GET /api/minima/backups/password
POST /api/minima/backups/password
POST /api/minima/backups/:fileName/download
POST /api/minima/backups/restore
DELETE /api/minima/backups/:fileName
GET /api/minima/backups/auto
POST /api/minima/backups/auto
```

`GET /api/minima/backups/password` returns `{ "hasPassword": boolean }` (never the password itself). `POST /api/minima/backups/password` accepts `{ "backupPassword": string, "currentPassword": string }`, requires re-entering the admin PIN/password, and must be called before any backup can be created. `GET /api/minima/backups` returns a single array of backups (filenames still distinguish trigger source, `minima-manual-<ts>.bak` / `minima-auto-<ts>.bak`) under the shared `/minima-backups` volume. `POST /api/minima/backups` takes no body — it always creates a manual backup using the stored password and calls Minima `backup file:backups/<generated-name>.bak password:"<stored>"`; once the combined list exceeds 20, the oldest backup is deleted automatically. `POST /api/minima/backups/:fileName/download` requires `{ "currentPassword": string }`; every tracked backup is downloadable, since all of them share the same real, admin-chosen password. `POST /api/minima/backups/restore` also requires `{ "currentPassword": string }` and accepts either `{ "fileName": string }` for an existing tracked backup (uses the stored password automatically) or a multipart upload (`file` field, optional `password` override for a foreign `.bak` with different protection) — an uploaded file is deleted from the shared folder after the restore attempt either way, since it isn't a tracked entry. Restore calls Minima `restoresync file:backups/<name>.bak host:<configured-megammr-host>`. `DELETE /api/minima/backups/:fileName` removes a backup file (no re-auth — it only deletes a copy of already-recoverable data). `GET`/`POST /api/minima/backups/auto` read/toggle the backend's own nightly auto-backup scheduler (00:30 on the backend container's clock, not Minima's built-in one); enabling it requires a backup password to already be set, and every auto backup lands in the same shared, 20-backup-capped list as manual ones.

Wallet and account APIs:

```http
GET /api/wallet
GET /api/wallet/accounts
POST /api/wallet/accounts
GET /api/wallet/history
POST /api/wallet/send-payment
GET /api/wallet/payment-status/:txpowid
POST /api/wallet/import
POST /api/wallet/receive-address
```

`POST /api/wallet/accounts` creates a named account label and maps it to one random default address from the node's existing 64-address wallet pool, or labels an existing address when `address` is provided. This does not create new seed material.

`GET /api/wallet/accounts` returns the mapped accounts plus per-address MINIMA/token balances aggregated from Minima `coins relevant:true`, and `unlabeledFunded` for migration.

`GET /api/wallet/history?limit=N` returns recent send activity recorded in SQLite when payments are submitted.

`POST /api/wallet/receive-address` samples a random address from the 64-address pool (API retained; primary UI shows per-account addresses in the account detail modal).

Custom token APIs:

```http
GET /api/tokens
GET /api/tokens/create-requirements
POST /api/tokens/create
```

`GET /api/tokens` returns non-native token balances from Minima `balance`, enriched with local metadata when the token was created on this Pi (`custom_tokens` in SQLite). `POST /api/tokens/create` (admin) calls Minima `tokencreate` with `{ name, amount, decimal, fromAccountAddress }` where `fromAccountAddress` must be a **labeled** wallet account with at least `0.001` MINIMA on its address. `GET /api/tokens/create-requirements` returns cost estimates. Wallet list/send APIs are unchanged.

Integritas:

```http
GET /api/integritas/config
POST /api/integritas/hash
POST /api/integritas/stamp
POST /api/integritas/status
POST /api/integritas/verify
```

Integritas Connect (device linking):

```http
POST /api/auth/connect/start
GET /api/auth/connect/status
GET /api/user/profile
```

The frontend sends canonical bytes and proof payloads to the backend. The backend performs SHA3-256 hashing and calls Integritas with the Connect-linked API key from `integritas_auth.api_key_enc`.

The backend uses the first available source in that order. Install with a fallback Integritas API key:

```bash
curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/install.sh | sudo INTEGRITAS_API_KEY=your-api-key bash
```

For the preferred prototype UX, install without a key and then enter it in the Integritas page in the browser.

## Security Notes

This is a learning prototype, not a production-ready product.

See [`SECURITY.md`](./SECURITY.md) for the current risk register, known vulnerabilities, and mitigation plan.

- Backend container runs as the non-root `node` user
- Host files are mounted read-only
- Backend blocks access outside `/host-files`
- Frontend cannot trigger shell commands
- Minima RPC binds to `127.0.0.1` by default
- Integritas Connect tokens and API key are backend-only and encrypted at rest in SQLite
- Backend mounts `/var/run/docker.sock:ro` to read container status and resource usage for the App status page. This is useful for the prototype, but Docker socket access is sensitive and should be replaced with a narrower monitoring approach before production.
- GPIO input sources use the `gpiomon` tool inside the backend container and GPIO LED output targets use `gpioset`; both require explicit GPIO device access on Raspberry Pi deployments. Add an override such as `devices: ["/dev/gpiochip0:/dev/gpiochip0"]` and a suitable GPIO group when enabling GPIO hardware ingestion/control.
- BME280/BME680 sensor reads use the opt-in host-side `edge-studio-sensor-helper` service with I2C access instead of exposing generic I2C operations through the backend API.
- Admin authentication with a 6-digit PIN or an 8+ character password containing uppercase, lowercase, a number, and a symbol, plus HttpOnly session cookies (see [Authentication](#authentication))
- HTTPS with a self-signed certificate on the default Docker deploy (`COOKIE_SECURE=true`)

## Future Services

The Docker Compose file is intentionally simple so more services can be added later, for example:

- Database
- File storage
- CLI session or API token auth
- System commands through an allowlist
- Auto updates

When new services require host packages, add them to the dependency section in `install.sh`.
