# Edge Studio Capabilities and User Stories

## Purpose

This document describes what a user can do with Edge Studio today. It is intended for product-scope review and sign-off: confirm that the listed capabilities meet the intended need, and identify anything that should be added or improved.

Edge Studio is a self-hosted Raspberry Pi application used from a browser on a trusted local network. It combines Minima node and wallet operations, Integritas proof stamping, connected devices, and automated workflows.

## Scope at a glance

| Area              | A user can                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Set up and access | Create one local account, link an Integritas account, sign in, sign out, and change the account credential.                                   |
| Monitor           | View the appliance, Minima node, wallet, Integritas connection, device activity, and recent proof activity from the dashboard.                    |
| Create evidence   | Stamp uploaded files with Integritas, verify proof files, inspect proof history, download proofs, and generate verification reports.              |
| Connect devices   | Configure supported inputs and outputs, test them, inspect their latest activity, and enable supported Raspberry Pi hardware from the UI.         |
| Automate          | Build, enable, run, monitor, and troubleshoot visual workflows that connect triggers, data, conditions, outputs, payments, and Integritas stamps. |
| Operate Minima    | Monitor, restart, resynchronise, back up, restore, and perform selected allowlisted Minima node actions.                                          |
| Use a wallet      | View balances and history, receive and send payments, and manage an address book.                                                                 |
| Review history    | Search and filter proof, device-read, and workflow-run records; inspect storage; export or import a read-only history archive.                    |
| Maintain the app  | Check for signed software updates, apply them from the UI, adjust local UI preferences, and submit product feedback.                              |

## Detailed capabilities

### Setup and access

- Set up the appliance on first use with either a six-digit PIN or a strong password.
- Link the appliance to an Integritas Connect account for proof stamping and plan usage.
- Sign in to the single local account and sign out when finished.
- Change the PIN or password; changing it ends all active sessions.
- Follow a first-use guided tour and replay it later from Settings.
- Use the interface on desktop, tablet, or mobile-sized screens.

### Dashboard and status

- See the Raspberry Pi's basic system information, CPU, memory, and disk usage.
- See Minima node state, Integritas connection state, and current wallet balance.
- See a suggested next action when no devices or workflows have been configured.
- Review recent device reads and Integritas proof activity, including pending, successful, and failed outcomes.

### Integritas evidence

- Upload a file and create an Integritas timestamp proof for its hash.
- See the proof identifier, hash, and current status after submitting a file.
- Upload an Integritas proof JSON file and verify it.
- Review stored proof requests in Diagnostics, including pending, confirmed, and failed records.
- Verify a stored proof again, view a generated PDF verification report when available, and download individual or selected proof exports.
- Download a proof and its associated source material as a ZIP where available.

### Devices and data sources

- Add, edit, inspect, and remove supported data inputs and output targets.
- Manually read compatible data sources and inspect their latest result, preview, hash, timestamp, and error state.
- Test configured output targets before using them in a workflow.
- Use built-in device setup guidance, including ESP32 MQTT starter firmware and shortcuts to create applicable starter workflows.

Supported inputs:

- HTTP JSON APIs.
- Webhook JSON receivers.
- MQTT JSON subscriptions, including an ESP32 MQTT board onboarding profile.
- Raspberry Pi GPIO inputs, including button and PIR-motion use cases.
- BME280 and BME680 I2C environmental sensors.
- Raspberry Pi Camera photo and short-video capture.
- Local device-system information, such as performance and network-interface status.

Supported outputs:

- GPIO LED pulse.
- HTTP JSON request.
- MQTT JSON publish.
- HTTP upload of captured camera media.

Hardware controls:

- View the readiness of camera, GPIO, I2C-sensor, and local MQTT-broker support.
- Enable, disable, or repair those optional capabilities from the browser.
- Apply the supported automated I2C prerequisite setup and receive reboot guidance when necessary.

### Workflow automation

- Create workflows with a visual block canvas and backend validation.
- Name, edit, duplicate, archive, restore, pause, enable, or delete workflows.
- Add, configure, reorder, disable, or remove workflow blocks.
- Run eligible workflows manually, including with a custom JSON trigger payload.
- Watch live and historic runs on the canvas, inspect block-by-block results, timings, inputs, outputs, errors, and links to related reads and proofs.
- View workflow-generated previews in an inbox and mark them read, unread, or delete them.
- Use an in-app workflow block reference guide.

Available workflow building blocks:

| Category | Available actions                                                                                |
| -------- | ------------------------------------------------------------------------------------------------ |
| Start    | Manual run, schedule, GPIO event, webhook event, MQTT event.                                     |
| Data     | Record the triggering event, fetch a data source, capture camera media, set a workflow variable. |
| Logic    | Compare a field against a condition; wait for a defined period.                                  |
| Action   | Show a local preview, control a configured output, send a Minima payment.                        |
| Evidence | Attach an Integritas stamp to a recorded event, fetched data, or camera capture.                 |

### Minima node and wallet

- Monitor Minima node health, sync progress, peer count, block age, storage, and container resource use.
- Configure the Megammr host used for resynchronisation and restore.
- Start a background resynchronisation and follow its progress, recent events, outcome, and recovery state.
- Restart the Minima container gracefully from the UI.
- Manage encrypted node backups: set or clear the backup password, create a backup, enable or disable nightly backups, list, download, upload, restore, and delete backups.
- Inspect peers and add peer addresses through the supported action.
- Use a deliberately restricted, allowlisted Minima RPC console after confirming the current credential.
- View Minima and supported-token balances.
- Generate a receive address for incoming payments.
- Send Minima or supported-token payments to a direct address or saved contact.
- Search, filter, and inspect received, sent, and self-transfer history, including confirmations and failures.
- Create, edit, and remove address-book contacts; the appliance's own protected contact can have its name and notes updated.

### Diagnostics, history, and storage

- Search, filter, paginate, and customise visible columns for proof records, device-read logs, and workflow-run logs.
- Review the status and details of manual and automated device reads, webhook events, MQTT messages, GPIO events, and workflow runs.
- Review managed application storage by record and file category.
- Export a read-only, secret-redacted archive of wallet, workflow, device-read, and Integritas history after confirming the current credential.
- Import a compatible history archive for viewing historical records.

### Software updates, preferences, and feedback

- Check whether a signed Edge Studio update is available, compare installed and available versions, and read release notes.
- Start an in-app software update and follow its progress on a page that remains available during the application swap.
- Choose whether modals close on an outside click and whether the desktop sidebar starts collapsed.
- Submit bugs, UX issues, questions, feature requests, or other feedback from any page, with explicit consent before relevant non-secret device and browser context is sent to Integritas.

## End-to-end user stories

### 1. Capture and prove a sensor reading

**As a user,** I want to record an environmental reading and create evidence of it so that I can later demonstrate what the sensor reported at that time.

1. I enable I2C sensor support from Devices and complete any hardware or reboot steps shown by the application.
2. I add a BME280 or BME680 sensor with its I2C address and confirm that a manual read succeeds.
3. I create a scheduled workflow that fetches the sensor, optionally shows a local preview, and attaches an Integritas stamp to the fetched data.
4. I enable the workflow.
5. The application reads the sensor on schedule, records the result and hash, and creates an Integritas proof request.
6. I use Workflow Watch or Diagnostics to inspect the run, its reading, and the linked proof; I can later verify or download the proof.

**Outcome:** The user has a local history of the reading and a linked timestamp proof for its captured data.

### 2. React to a physical motion event

**As a user,** I want motion on a Raspberry Pi sensor to trigger a camera capture and proof so that I have evidence of an event without manually operating the system.

1. I enable GPIO and camera support from Devices, following the displayed hardware prerequisites.
2. I add a PIR motion sensor input and a Raspberry Pi Camera device.
3. I create a workflow started by the motion sensor, set an appropriate cooldown, capture a photo or short video, and attach an Integritas stamp to the capture.
4. I enable the workflow.
5. When motion is detected, the workflow captures the media, records its metadata and hash, and submits the media hash for stamping.
6. I review the run and proof in Watch or Diagnostics, including any capture or stamping failure.

**Outcome:** A physical event creates a reviewable local record and an associated proof of the captured media hash.

### 3. Receive data from an external device and notify a system

**As a user,** I want an ESP32 or other MQTT device to report an event and trigger an action so that connected equipment can respond automatically.

1. I enable the optional local MQTT broker or configure access to an approved MQTT broker.
2. I add an MQTT input, optionally using the ESP32 onboarding flow and its generated starter firmware.
3. I add an HTTP or MQTT output target and test it from Devices.
4. I build a workflow that starts when the MQTT topic receives JSON, records the event, checks a field condition, and controls the output only when the condition matches.
5. I enable the workflow and monitor incoming events in the workflow Watch view.
6. I inspect the read log, action result, and any preview or error in Diagnostics.

**Outcome:** A connected device can trigger a validated, observable response without custom automation code.

### 4. Create and verify a document proof

**As a user,** I want to prove that a document existed in a particular form so that I can provide independently checkable evidence later.

1. I link Edge Studio to my Integritas Connect account during setup or on the Integritas page.
2. I open Integritas, choose a file, and submit it for stamping.
3. I receive the proof identifier, file hash, and current proof status.
4. I monitor the record in Diagnostics until its final status is available.
5. I download the proof and, when required, upload a proof JSON file to verify it or re-verify the saved proof record.
6. I open or download the generated verification report when one is available.

**Outcome:** The user can retain and present an Integritas proof and verification result for the document.

### 5. Operate and protect the Minima wallet

**As a user,** I want to manage the node's wallet and backup so that I can receive funds, make controlled payments, and recover the node if necessary.

1. I check the Minima page to confirm that the node is running and synchronised.
2. I open Wallet, generate a receive address, and share it with a payer.
3. I monitor the incoming payment and confirmation in wallet history.
4. I add a known recipient to the address book and send a payment when needed.
5. I set the encrypted backup password, create a manual backup, and enable the nightly backup if desired.
6. If recovery is required, I confirm my current credential, upload or select a backup, and restore it through the Minima page.

**Outcome:** The user can manage payments and retain an encrypted recovery path for the Minima node.

## Scope boundaries and approval questions

The following are intentionally not included in the current application scope:

- Multi-user accounts, usernames, roles, or tenant separation. Edge Studio has one local account with full access.
- Public-internet or production-hardened deployment. It is intended for a trusted local network and uses a self-signed HTTPS certificate by default.
- A marketplace, plugin catalogue, or generic device-driver framework. The Marketplace page is marked Coming soon.
- Arbitrary shell commands or unrestricted Minima RPC access. Node actions and console commands are deliberately allowlisted.
- General workflow templates. Device-specific setup guides can create selected starter workflows, but there is no template library.
- Browser controls for data retention, storage cleanup, quotas, or operational-installation migration. Storage inventory and read-only history export/import are available today.
- Restoring an active system from a history archive. Imports are for viewing history only and do not restore devices, workflows, contacts, credentials, backups, or captures.
- A generic camera, sensor, or hardware integration layer. Camera, GPIO, I2C sensors, and the local MQTT broker are optional Raspberry Pi capabilities that require compatible hardware and host setup.

Questions for sign-off:

1. Does the combination of evidence creation, devices, workflow automation, Minima operations, and wallet functionality meet the intended first release?
2. Which device types, workflow templates, or external integrations are essential beyond the supported list?
