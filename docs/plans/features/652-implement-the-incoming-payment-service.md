# Incoming Payment Service and Wallet History Filtering Plan

**Status:** In progress
**Created:** 2026-10-09
**Branch:** `task/652-implement-the-incoming-payment-service`
**Audit baseline:** `620bef8c` (clean working tree before this planning session)
**Goal:** Show incoming and outgoing wallet payments in one durable, server-paginated Wallet history with date-rich filtering, without leaving the app's own design system.

## Progress

- [x] Step 0: Pi RPC capture (`266899fc`) — 2026-10-09, mainnet Minima 1.1.2.6, then a private testnet on the dev Pi (`docker-compose.testnet.yml`, `docs/guides/minima-testnet.md`; deviation: the plan only planned read-only mainnet capture, but the mainnet wallet had no history).
  - Matches step 1 fixtures: `txpow onchain:` found/not-found (`block`/`tip`/`confirmations` are strings), `txpow txpowid:` returns the TxPoW as `response`, `scripts` row keys/flags, `history action:size` → `{ size }`, `history` `{ txpows, details, size }` with `details[i].{inputs,outputs,difference}`.
  - Received (+10), sent (−2.5), and self (0) recorded and trimmed into `backend/tests/fixtures/minima-testnet-history.json`; `parseHistoryResponse()` handles all three.
  - **`send` returns the pre-mined TxPoW** (`nonce` 0). Async mining changes the TxPoW ID, so the stored send-log `txpow_id` never appears on chain (`txpow txpowid:` → "TxPoW not found"). `body.txn.transactionid` is unchanged after mining. Steps 2–4 link send-log rows to chain rows by transaction ID (see below).
  - `history max:100` takes 7–17 ms with 3 rows. Test mode creates 8 default addresses (mainnet 64).
  - Fingerprint stability across a node restart moves to Pi QA.
  - Checked against [`spartacusrex-minima/minima-core`](https://github.com/spartacusrex-minima/minima-core) `main` (1.1.2.31; Pi image 1.1.2.6, matches `minima-global/Minima` `dev-pureminima-core`, not `master` 1.0): `send`, `TxPoWMiner`, `txpow`, `TxPoW`/`Transaction`/`TxHeader` JSON unchanged, so the pre-mined TxPoW ID finding holds. `history` adds `details[i].tokens` (`{ tokenid: name }`); additive, parser unaffected. Its `Token.getTokenName()` returns `"Error token name.."` for plain-string names, so keep the coin-derived name.
- [x] Step 1: Parsers for `history`, `history action:size`, `txpow onchain:`, and fix `parsePaymentStatusResponse` (`aeaf487e`)
  - Tracked-address parsing is a new `parseTrackedScriptAddressesResponse()` (scripts with `track: true`, matching Minima's `isAddressRelevant`). `parseLocalWalletAddressesResponse()` is unchanged.
  - `getPaymentStatus()` now asks `txpow onchain:` first (confirmed) and falls back to `txpow txpowid:` (pending/unknown). `isTxPowId()` validates the ID in the service and in `GET /payment-status/:txpowid` (400), which previously passed the raw param into the RPC command.
  - Self-transfers carry amount `0` (the `difference`). `history`'s list `size` is the page length, not the total; use `history action:size` for the total.
  - Source-derived fixtures live in `backend/tests/helpers/minimaHistoryFixtures.ts`; swap in Pi captures after step 0.
- [x] Step 2: `wallet_transactions` table, wallet fingerprint, and history sync service (`c1e3a06d`)
  - `wallet-history.service.ts`: `getWalletFingerprint()`, `syncWalletHistory()`, `refreshPendingConfirmations()`.
  - Sync state (`wallet_history_sync_state` setting) holds fingerprint, size, and a `backfillOffset`. When the 5-page cap cuts a scan short, the next tick resumes there; rows only move to higher offsets as new ones arrive, so nothing is skipped. A page of only malformed TxPoWs does not count as "fully known".
  - Overlapping `syncWalletHistory()` calls share the running sync instead of being dropped, so step 4's route can await it.
  - Re-syncing a known row keeps its block/confirmation data. A TxPoW relevant to both old and new wallets moves to the new fingerprint.
  - `confirmations` is stored once, when the TxPoW is first found on chain; it is not kept current.
  - `parseSendResponse()` and `parseHistoryResponse()` return `transactionId` (verified on the Pi fixture: the send's `transactionid` matches the chain row's).
- [x] Step 3: Sync hooks (health poller, wallet replacement, send paths) (`d7f11c64`)
  - The health poller runs `syncWalletHistory()` and then `refreshPendingConfirmations()` on each running-node tick, before stall detection. Both log their own failures, so there is no extra `try/catch`.
  - Deviation: no `invalidateWalletFingerprint()`. `runWalletReplacement()` bumps `getWalletReplacementCount()` after every attempt, and the cached fingerprint is reused only while the count is unchanged. This avoids an import cycle, and a fingerprint read during a replacement is not reused afterwards.
  - `refreshPendingConfirmations()` also skips while a replacement runs.
  - `recordWalletSendHistory()` is now async and stores fingerprint, origin (`manual`/`automation`), and transaction ID. If the fingerprint lookup fails, the row is still saved, with a null fingerprint.
  - Pi QA 2026-10-09 (testnet, `v0.42.2-dev+d7f11c6`, backend/frontend images rebuilt only): first sync stored the 3 recorded rows; a peer payment appeared as `in` within one tick; unchanged history wrote nothing; a UI send and an automation-workflow send stored origin, transaction ID, and fingerprint and linked to their chain rows (UI send seen pending, then confirmed a tick later).
  - Finding: a TxPoW found on chain in its tip block stores `confirmations: 0` forever. Step 4 derives confirmations from the current tip at read time instead of serving the stored value.
  - Found and fixed on the way: the Send payment amount input lacked `step="any"`, so browsers rejected decimal amounts.
- [x] Step 4: Paginated, filtered `GET /api/wallet/history` and admin re-auth clear of previous-wallet rows (`84e2f05a`)
  - `listWalletHistory()`/`clearPreviousWalletHistory()`/`syncWalletHistoryIfStale()` in `wallet-history.service.ts`. The route syncs first unless a sync finished in the last 5 s.
  - Status values are `pending`/`confirmed`/`failed`. `from` is inclusive and `to` exclusive; both are ISO date-times with a time zone. Default page size is 25. The response adds `previousWalletItems` so step 5 can show the clear action only when it applies.
  - `confirmations` is the current tip block minus the row's block, read at request time with one `block` call; the stored column is not served.
  - Unsynced sends are listed without a TxPoW ID (the stored one is the pre-mined ID). Sends recorded before transaction IDs existed can't be matched to chain rows: failed ones are listed, submitted ones are hidden (their chain row shows instead).
  - If Minima is unreachable, stored rows are still listed, with no confirmation counts and nothing marked previous-wallet. Clearing returns 409 while a replacement runs (or one finished during the wallet read) and 502 if the wallet can't be read.
  - Clear reuses `verifyCurrentPassword()` from `minima-backup.service.ts`.
  - The current Wallet page still reads `{ sends }` and crashes ("Something went wrong") until step 5.
  - Pi QA 2026-10-09 (testnet, `v0.42.2-dev+84e2f05`, via the API from a logged-in browser):
    - All 7 rows listed newest first, with live confirmation counts; the row that showed 0 now counts up.
    - Direction, status, search, and from/to filters return the expected counts; invalid status, direction, date, and range return 400.
    - A send appears immediately as a pending send without a TxPoW ID. After the next sync it is replaced by its chain row (no duplicate), with origin kept.
    - Two injected previous-wallet rows were flagged and counted. A wrong PIN returned 401 `invalid_credential` and kept the session; the right PIN deleted exactly those 2 rows and recorded `wallet.history.clear_previous` with `{"deleted":2}`.
- [x] Step 5: Frontend history panel, filters, detail modal, and clear action (`17f0b251`)
  - `WalletPage.tsx` loads status and history separately. History reloads quietly on each Minima status tick (30 s) and after the send dialog closes, so incoming payments and confirmations show up without a page reload.
  - Filters: status, type (Received/Sent/Self), date preset (Today, Last 7 days, Last 30 days, This month, Custom range), and search. Presets and custom days are local time; a custom range includes both days. Filter helpers live in `walletHistory.ts`. Status, type, and date filters sit on their own row above a full-width search.
  - Deviation: contact labels are resolved by the backend (`counterpartyLabel` on each item, matching Mx and 0x forms), not in the browser, because matching needs Mx checksum decoding.
  - Deviation: the clear dialog is a `Modal` with `CredentialField` (`ClearPreviousHistoryModal.tsx`), same as "Remove backup password". `DeleteConfirmModal` has no slot for a credential field.
  - `applyPaginatedPage()` moved to `frontend/src/lib/paginated.ts`.
  - Pi QA 2026-10-09 (testnet, `v0.42.2-dev+17f0b25`, headless browser):
    - The Wallet page loads again: 8 rows with signed amounts, contact names, Received/Sent/Self, and confirmed status.
    - Type, status, date preset, custom range (same day, future days, end before start), and address search filters return the expected rows.
    - The detail view shows sender name and address, date, confirmation time, block with confirmation count, token, TxPoW, and transaction IDs.
    - A 0.75 send from the dialog appeared at once as Pending and turned Confirmed 48 s later without a reload, with no duplicate row.
    - Two injected previous-wallet rows brought up the banner within one refresh. A wrong PIN showed "Invalid current credential" and kept the session; the right PIN deleted 2 and the banner disappeared.
    - Diagnostics paging still works after the helper move.
    - Finding, fixed in the follow-up commit: search matched addresses and IDs but not contact names. Search now also matches rows whose counterparty is a contact with a matching name, in either address form (`miniMinimaAddress()` in `shared/minima-address.ts` encodes the Mx form).
    - Finding, fixed in the follow-up commit: "Confirmed" was the time the app first saw the confirmation. It is now the block's TxPoW time, read with `txpow txpowid:<blockid>` (one extra call per newly confirmed row; verified on the Pi that the response carries `header.timemilli`).
    - Follow-up Pi QA (`75e3420`): after clearing the stored confirmation times, all 9 rows re-confirmed within 50 s with block times that match `txpow txpowid:<blockid>` (the +10 receive now shows 08:42:30 instead of 11:29). Searching "peer" or "652 qa" returns the 7 rows with that contact; "nobody" shows the empty state.
- [x] Docs — CHANGELOG branch section, README wallet API and sync behaviour, SECURITY bullet and `docs/security/wallet-and-tokens.md` "Wallet History Clear", ADR 0033 (`docs/README.md` table), SESSION/TASKS.
- [ ] Verification

## Context

[OpenProject #652](https://openproject.privateprivate.org/work_packages/652), “Implement the incoming payment service”, and [#655](https://openproject.privateprivate.org/work_packages/655), “OPTIONAL Improve wallet history filtering”, are tasks under feature #285 Wallet Incoming History Service. #652 includes #655. Together they ask for:

- Incoming payments in Wallet history, not only outgoing.
- Standard wallet-history features, using the in-house [Minima Wallet MiniDapp](https://github.com/minima-global/Wallet) as a code reference.
- Date-rich fields and filtering so a user can tell when a payment was sent or received (#655 warns UX may push it past 8h).

### Current state (audit)

| Area | State |
| --- | --- |
| Persistence | `wallet_send_history` (`backend/src/db/database.ts`) is written only by app sends: `wallet.routes.ts` `POST /send-payment` and `automation.service.ts` send-transaction block, both via `recordWalletSendHistory()`. Nothing records incoming payments. |
| Status | Rows are `submitted` or `failed` forever; nothing moves them to confirmed. |
| API | `GET /api/wallet/history?limit` returns `{ sends }` with no offset. `WalletPage.tsx` requests 20 rows, so older sends are unreachable. |
| UI | `WalletHistoryPanel.tsx` filters and paginates those 20 rows client-side. `HistoryDetailModal.tsx` has no direction, sender, or confirmation data. |
| Bug | `parsePaymentStatusResponse()` reads `response.txpow`, but Minima's `txpow txpowid:` returns the TxPoW itself as `response`, so the result is always `unknown`. Its tests use the same wrong shape. `GET /payment-status/:txpowid` has no frontend caller. |
| Wallet replacement | Seed import (`wallet.service.ts:importWallet`), backup restore (`minima-backup.service.ts`), and replacing console commands (`minima-console.service.ts`) all go through `runWalletReplacement()` (`address-book/wallet-replacement.service.ts`). |
| Server pagination | Diagnostics already uses `parseListQuery()`/`toPaginatedResult()` (`backend/src/shared/list-query.ts`) and `PaginatedResponse`/`emptyPaginatedPage`/`buildListQueryString` (`frontend/src/lib/paginated.ts`) with `ListPaginationFooter`. `applyPaginatedPage()` is local to `DiagnosticsPage.tsx`. |

### Minima source audit (upstream `master`, not yet verified against the deployed image)

- [`history`](https://github.com/minima-global/Minima/blob/master/src/org/minima/system/commands/search/history.java) `max:` `offset:` (default 100) returns relevant TxPoWs newest-first (`isrelevant=1 ORDER BY timemilli DESC`) as `{ txpows, details, size }`. Each `details[i].difference[tokenid]` is relevant outputs minus relevant inputs: positive = received, negative = sent, zero = self-transfer. `history action:size` returns the relevant count cheaply.
- Minima never prunes relevant TxPoWs (`DELETE ... WHERE isrelevant=0`).
- [`txpow onchain:<id>`](https://github.com/minima-global/Minima/blob/master/src/org/minima/system/commands/search/txpow.java) returns `{ found, block, blockid, tip, confirmations }`.
- `history` is already a read entry in the console catalog.
- The Minima Wallet MiniDapp calls `history`, caches TxPoWs into its own SQL table, derives IN/OUT from the sign of `difference`, and offers search, sort, a month timeline, day grouping, CSV export, running balance, and a detail view. It is a reference for derivation logic only; UI stays ESDS.

### Decisions (2026-10-09)

- **Persist into SQLite** rather than proxying `history` live. Minima's TxPoW DB may not survive `restoresync`/Megammr resync; app-recorded data (failed sends, app/automation origin) only exists locally. Store derived fields only, never raw TxPoW JSON (the MiniDapp stores KBs per row). Roughly 300–400 bytes per row; worst case is a payment workflow at the 1,000 runs/hour budget (~24k rows/day). Wallet history is a financial record: no automatic retention (ADR 0023 classification), user-controlled clearing only.
- **Previous-wallet rows are kept and marked.** Rows carry the wallet fingerprint they were synced under; rows from another wallet show as “Previous wallet”. Only previous-wallet rows can be cleared (current-wallet rows would re-sync from Minima). Clearing is admin-only and re-entering the PIN/password is required, same pattern as backup download.
- **Date filtering** uses presets plus a custom range in ESDS components, not a Minima-style month timeline.
- **Spike is non-blocking.** Build parsers against source-derived fixtures; capture real responses on the Pi in parallel and swap them in as fixtures.
- **Deferred:** CSV export (comment on #652 tagging Rowel for a new ticket), running balance per row, day grouping/month timeline, token-creation rows, incoming payments as an automation trigger, stuck/dropped-transaction detection, backing up wallet history / the app SQLite database (second comment on #652 tagging Rowel).

## Step 0: Pi RPC capture

Read-only, via the `pi-ssh` skill, about 15 minutes. Record the image version (`minimaglobal/minimacore` is unpinned) and save redacted responses as test fixtures:

- `history max:5`, `history action:size`, `txpow onchain:<a known txpowid>`, `scripts`.
- Time a `history max:100` call to size sync page limits.
- Confirm default script addresses are stable across a backend/node restart (fingerprint input).

Restore/resync durability of Minima's history and whether payments received while offline appear are checked during final Pi QA; the answers only change documented limitations.

## Backend changes

### 1. Parsers (`backend/src/features/wallet/wallet.parse.ts`)

- `parseHistoryResponse(body)`: zip `txpows[i]`/`details[i]`; per TxPoW and per token in `difference` emit `{ txpowId, tokenId, tokenName, difference, direction: "in" | "out" | "self", timeMillis, counterparty }`. Token name follows `parseToken()` handling (string, metadata object, `0x00` → Minima). Counterparty is the first output (for `out`) or input (for `in`) whose address is not in the local wallet's script addresses; `null` when none. Malformed entries are skipped, not thrown, so one odd TxPoW never stops a sync.
- `parseHistorySizeResponse(body)` and `parseOnchainResponse(body)` with strict `status === true` checks.
- Broaden local-address parsing to return all tracked script addresses for counterparty detection, keeping `parseLocalWalletAddressesResponse()` behavior for #206.
- Fix `parsePaymentStatusResponse()` to read the real `txpow` shape and derive confirmation from `txpow onchain:`; correct its tests.

### 2. Storage and sync

- `database.ts`: add `wallet_transactions` (`txpow_id`, `token_id` composite primary key; `transaction_id`, `direction`, `amount` as decimal string, `token_name`, `counterparty`, `time_millis`, `block`, `confirmations`, `confirmed_at`, `wallet_fingerprint`, `synced_at`) with indexes on `time_millis` and `transaction_id`. Add nullable `wallet_fingerprint`, `origin` (`manual` | `automation`), and `transaction_id` to `wallet_send_history` via `ensureColumn`. `parseHistoryResponse()`/`parseSendResponse()` also return `body.txn.transactionid`.
- New `backend/src/features/wallet/wallet-history.service.ts`:
  - `getWalletFingerprint()`: SHA-256 of sorted canonical default addresses from `getLocalWalletAddresses()`, cached, invalidated after wallet replacement.
  - `syncWalletHistory()`: overlap-locked; skip while `isWalletReplacementInProgress()`. Compare `history action:size` with the last stored size (settings table); when changed, page `history max:100 offset:N` newest-first, upsert rows, and stop at the first fully-known page. Cap pages per call; continue next tick.
  - `refreshPendingConfirmations()`: for a bounded batch of unconfirmed rows, call `txpow onchain:` and store block, confirmations, and confirmation time.
- Every RPC failure leaves stored rows untouched and logs without secrets.

### 3. Hooks

- `minima-poll.service.ts`: call `syncWalletHistory()` after `initializeLocalAddressBookEntry()` when the node is running, in its own `try/catch` so it never affects stall/resync monitoring.
- `runWalletReplacement()`: invalidate the cached fingerprint after `replace()`.
- `recordWalletSendHistory()`: store the current fingerprint, origin (`manual` from the route, `automation` from the workflow block), and the transaction ID from the send response. The send-log `txpow_id` is the pre-mined ID and is not shown as a chain ID.

### 4. API (`wallet.routes.ts`)

- `GET /api/wallet/history?page&pageSize&direction&status&q&from&to` returns `PaginatedResult` via `parseListQuery()`/`toPaginatedResult()`. Direction, `from`, and `to` (ISO instants) are validated in the route. Items are a `UNION ALL` of `wallet_transactions` joined to the send log by `transaction_id` (adds origin) and send-log rows not yet seen on chain (failed, or submitted and pending). Each item carries `isPreviousWallet`. Before reading, run `syncWalletHistory()` if the last sync is older than a few seconds.
- `POST /api/wallet/history/clear-previous`: `requireRole("admin")`, `authRateLimiter`, `verifyCurrentPassword()`; 401 failures return `errorCode: "invalid_credential"`; records `wallet.history.clear_previous` with the deleted count. Add to `backend/tests/app.401-smoke.test.ts`.
- `WalletSendHistoryItem` is replaced by a `WalletHistoryItem` type in `wallet.types.ts`.

## Frontend changes

- `walletTypes.ts`/`walletApi.ts`: `WalletHistoryItem`, `listWalletHistory(query)` returning `PaginatedResponse`, `clearPreviousWalletHistory(currentPassword)`.
- Move `applyPaginatedPage()` from `DiagnosticsPage.tsx` into `frontend/src/lib/paginated.ts` and use it in both pages.
- `WalletPage.tsx`: load history separately from wallet status and own the list query, so status failures and history failures stay independent.
- `WalletHistoryPanel.tsx`: server-paginated; direction filter (All / Received / Sent / Self) alongside status; date presets (Today, 7 days, 30 days, This month) plus custom range; signed amount with in/out tone and icon; From/To column resolved to address-book labels; “Previous wallet” pill; origin column (hidden by default). Empty/loading/error states follow ADR 0025.
- `HistoryDetailModal.tsx`: type, time sent (TxPoW time), confirmation time, block and confirmations, counterparty, token, TxPoW ID, origin.
- Clear previous-wallet history: admin-only action shown only when such rows exist, using `DeleteConfirmModal` with the credential input pattern from `MinimaBackupPanel.tsx`.

## Tests

- Backend: parser fixtures (source-derived, then Pi-recorded); sync service against the DB harness with mocked `minima.rpc.js` (paging stop, size unchanged, malformed rows, replacement in progress, fingerprint change); route tests for paging, filters, validation, clear with valid/invalid credential.
- Frontend: panel filters/presets/paging, previous-wallet pill and clear flow, detail modal fields, `applyPaginatedPage` in its new home.
- Wallet paths are a 90% coverage-bar module (`.claude/rules/testing.md`).

## Docs

- `CHANGELOG.md`: `## [Unreleased] task/652-implement-the-incoming-payment-service` — incoming payments, confirmation status, paginated/filterable history, previous-wallet marking and clear, status-endpoint fix.
- `README.md`: Wallet section and `GET /api/wallet/history` contract, `POST /api/wallet/history/clear-previous`.
- `SECURITY.md`: note the re-auth-protected history clear if the existing re-auth list is enumerated there.
- ADR: persisting synced Minima history (rejected live proxy, fingerprint marking, no retention).
- `docs/SESSION.md`/`docs/TASKS.md` via `session-notes`.

## Verification

- `npm run check`, `npm --prefix backend run build`, `npm --prefix frontend run build`, `docker compose config`.
- Pi QA: receive a payment from another wallet and see it appear as Received, then confirmed; send manually and via automation; confirm sync stays quiet when nothing changes; seed import/backup restore marks old rows as previous wallet; clear with wrong and right credential; check restore/resync durability and offline-receive behavior and record the results as limitations.
- `git status --short --untracked-files=all` before committing.
