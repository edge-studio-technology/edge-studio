# Run and test your own Edge Studio build

Read [the current contribution terms](../../CONTRIBUTING.md#before-contributing-code) before submitting code. Local source development does not require an internal OpenProject account or the team's Pi. You will need your own accounts for optional Integritas services and a GitHub account to submit a PR.

## Get the matching source

Install Git and Node.js 22 with npm. Native SQLite dependencies may need your platform's C/C++ build prerequisites if no compatible prebuilt binary is available. Use Linux or Git Bash/WSL for shell-based checks; Docker tests require a running Docker daemon, and hardware tests require a supported Pi and the actual device.

Fork the public repository, clone your fork and create a topic branch from upstream `dev`:

```bash
git clone https://github.com/YOUR-ACCOUNT/edge-studio.git
cd edge-studio
git remote add upstream https://github.com/edge-studio-technology/edge-studio.git
git fetch upstream
git switch -c add-my-device upstream/dev
npm install
```

The root postinstall installs backend, frontend and update-agent dependencies. Read the guides and skill **from the same checkout you are editing**, since `dev` and released `main` may differ.

## Native development

From the repository root, copy the tracked environment example only if you do not already have local configuration:

```bash
cp .env.example .env
node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'
```

Set the generated value as `APP_SECRET` in your local `.env`. Keep it private and stable for an existing development database; changing it can make encrypted settings unreadable. The example config uses repo-local `DATA_DIR`/`DATABASE_PATH`; use a disposable development database, not production data. Keep `COOKIE_SECURE=false` for local HTTP. Never commit `.env` or `.env.local`.

```bash
npm run dev
```

The backend loads the root `.env` and defaults to port 3000. Vite requests port **3030**, proxies `/api` to the backend, and prints the actual URL if that port is occupied. Open its printed Local URL. The local administrator/setup flow still applies. Minima, Integritas and hardware-dependent features can be unavailable until you configure their services; do not substitute team secrets to bypass setup. Tests provide isolated fixtures for most code changes.

For HTTPS/cookie/browser-API work, use `npm run dev:https` in a POSIX-compatible shell. This generates local self-signed certificates and starts the HTTPS development servers. Use `https://localhost:3030` or the actual printed port and accept the local certificate warning. See [README development instructions](../../README.md#local-development) for optional Docker service wiring.

## Verify the build you changed

Make a harmless visible change on a topic branch, such as temporary local page copy, and check it appears after saving. Stop any old preview server if it is serving a previous `dist` build. A source clone or branch selection alone does not prove that prebuilt containers are running your changes.

Record `git rev-parse HEAD`, `git status --short`, the modified file, the observed result and any uncommitted local difference. Do not include a temporary proof-only edit in an unrelated final PR.

## Fork source build on a disposable Pi

This installs root-owned helpers, Docker services and local state. Use a spare Pi/SD card with no valuable wallet/data, not your production installation. Do not run the commands on someone else's Pi without permission. Check the app's current [project constraints](../PROJECT.md) and existing hardware guide for actual compatibility; this guide does not promise every Pi/OS combination.

### 1. Publish from your development computer

In the checkout where you made the changes, review and commit the files you want to test. Uncommitted edits cannot be downloaded by the Pi. Confirm that `origin` points to **your fork**, and that you are on the intended branch:

```bash
git status --short
git remote get-url origin
git branch --show-current
git rev-parse HEAD
```

Record the full commit SHA printed by the last command as your **expected commit**. In this example, the branch is `add-my-device`; replace it with your actual branch name. Push it to your fork and check that the published branch has the same SHA:

```bash
git push -u origin add-my-device
git ls-remote origin refs/heads/add-my-device
```

The SHA in `git ls-remote` must match your expected commit. You do not need to open or merge a PR into the official repository to test your fork. An assistant should obtain your authorization before committing or pushing if you have not already given it.

### 2. Install from the Pi terminal

Run the following on the **test Pi**, either in its terminal or over SSH. Replace `YOUR-ACCOUNT` and `add-my-device` with the fork owner and branch you just pushed. Use the same values in both the download URL and installation command. For example, a branch named `feat/my-sensor` belongs in both places, including the slash.

Download the installer to your home directory, outside `/opt/edge-studio` so an installer refresh does not remove the file you are running:

```bash
cd ~
curl -fsSL https://raw.githubusercontent.com/YOUR-ACCOUNT/edge-studio/add-my-device/install.sh -o edge-studio-install.sh
```

If the download fails, stop and check the fork/branch and its access permissions. These commands assume a public fork; do not paste GitHub tokens into URLs. Read the downloaded installer:

```bash
less edge-studio-install.sh
```

Press `q` to exit the viewer, then install:

```bash
sudo env APP_REPO_URL=https://github.com/YOUR-ACCOUNT/edge-studio.git APP_BRANCH=add-my-device DEV_MODE=true bash edge-studio-install.sh
```

`APP_REPO_URL` and `APP_BRANCH` select source **in DEV_MODE**. Without `DEV_MODE=true`, the normal installer uses the signed runtime/release route, not your fork's source build. Source mode builds the frontend/backend, skips signed manifest verification, removes the official update-agent container and clears its applied-release marker. It is an unofficial development install; do not disable verification in the normal official release route.

Wait for the installer to finish successfully. It builds from the current branch tip, not from a separately pinned SHA, so leave the branch unchanged during installation and verify the result below. A failed install/build is not a successful update.

### 3. Verify the installed version and open the app

On the **Pi**, inspect the actual installation (default `/opt/edge-studio`; substitute your installation directory if customized). Use `sudo git` to read the installer-owned checkout:

```bash
sudo git -C /opt/edge-studio rev-parse HEAD
cd /opt/edge-studio
sudo docker compose ps
```

The full installed commit SHA must match the expected commit recorded on your development computer, and frontend/backend containers should be running and healthy. A matching source checkout alone does not prove a failed or old container was replaced: also confirm your changed behaviour in the browser. If the commit differs or containers are unhealthy, investigate before testing or claiming the new driver works.

Open the HTTPS address printed by the installer from a browser on the same network, normally `https://<pi-ip>:8080` (custom ports may differ). The default installation uses a self-signed certificate; check that you reached your own test Pi before continuing past that warning. Complete initial administrator setup if this is a fresh installation. Enable the required capability under **Devices → Hardware support**, then follow the new device's setup guide and verify its actual readings/events/outputs.

Record the expected and installed commits, Pi model, OS/architecture, setup steps and observed result. Do not claim physical verification from mocked RPCs or a locally successful TypeScript build.

### 4. Install subsequent changes

After editing on your **development computer**, review, commit and push the new changes to your fork branch. Record the new expected SHA and confirm it with `git ls-remote` as in step 1. Changes on that computer do not automatically update the Pi.

On the **Pi**, repeat step 2: download and inspect the latest installer from the same fork/branch, then rerun it with the same `APP_REPO_URL`, `APP_BRANCH` and **`DEV_MODE=true`**. This refreshes the source, rebuilds frontend/backend and starts the updated containers. Repeat step 3 and compare against the **new** expected commit, then retest the device. Keep custom installation paths/ports consistent when rerunning.

Do not use the official in-app updater for this source build. Installing an official release or omitting source mode will not install your unmerged fork changes.

### Installation handoff checklist

When an assistant helps prepare a Pi test, it should supply these details using the contributor's actual values:

- Fork URL and branch, plus the expected full commit SHA confirmed as pushed. If the changes are still uncommitted or unpushed, state that installation is not ready and explain the publication steps.
- Commands clearly labeled for the development computer versus the Pi, including the matching installer URL and source-mode installation command.
- Installed-commit comparison, container health check, browser address and the behaviour that will demonstrate the changes are running.
- Steps to publish and install the next revision, followed by the same verification. Preparing instructions does not authorize deployment or physical hardware actions.

Reinstall/update can replace source files under the installation directory. Keep your changes committed in the fork and your development checkout elsewhere; keep local data/configuration private. Read the installer's preservation behaviour and [uninstall guidance](../../README.md) before switching modes. Returning to an official release is a deliberate reinstall on a supported release/data format; compatibility or reversal of arbitrary custom host changes is not guaranteed. Never assume the standard installer exports an app-wide restorable device backup.

## Before proposing a change

Run focused tests for the affected behaviour, then the repository's required checks:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
npm --prefix update-agent run build
docker compose config
```

Full checks include lint/docs, Knip, typechecking, coverage and package audits. Shell/release checks need their documented POSIX tools; run the Ubuntu CI route rather than weakening assertions to fit a Windows-only environment. Docker config/build requires a suitable local `.env` and daemon. A failed command stays a failed command: report the failure and successful focused checks separately, with enough detail to reproduce. Do not ignore audit/coverage failures or write “all tests passed” when a stage stopped early.

For device changes start with the [device recipe](./contributing-devices.md); for runtime changes use the [workflow recipe](./contributing-workflows.md). Open a focused PR against `dev` under the MIT contribution terms.
