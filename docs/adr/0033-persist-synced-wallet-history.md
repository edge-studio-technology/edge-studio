# 0033: Persist Synced Minima Wallet History in SQLite

**Status:** Accepted
**Date:** 2026-10-09

## Context

OpenProject #652 (with #655) asks for incoming payments in Wallet history, confirmation status,
and date filtering. Before this change, Wallet history listed only payments the app itself
submitted (`wallet_send_history`), and those rows stayed `submitted` or `failed` forever.

Minima's `history` command returns every TxPoW relevant to the wallet, newest first, as
`{ txpows, details, size }`. Each `details[i].difference[tokenid]` is relevant outputs minus
relevant inputs, so its sign gives the direction. `history action:size` returns the count cheaply,
and `txpow onchain:<id>` returns the block and confirmation count. Verified on the dev Pi against
a private testnet (2026-10-09, Minima 1.1.2.6): these shapes match upstream source, and
`txpow txpowid:<blockid>` returns the block's time in `header.timemilli`.

Two constraints shaped the design:

- Minima's own TxPoW database may not survive `restoresync` or a Megammr resync, and some data
  exists only in the app: failed sends never reach the chain, and whether a send came from the
  Send dialog or an automation workflow is not recorded by Minima.
- The node's wallet can be replaced (seed import, backup restore, console restore/reset). History
  recorded under the old wallet is still a financial record, but it no longer describes this
  node's funds.

## Decision

- **Copy history into SQLite.** `syncWalletHistory()` pages `history max:100 offset:N` into
  `wallet_transactions`, one row per TxPoW and token, storing only derived fields (direction,
  amount as a decimal string, token, counterparty, time, transaction ID, block, confirmation
  time). Raw TxPoW JSON is never stored. The sync runs from the Minima health poller and before
  a history read older than 5 seconds. It skips the scan when `history action:size` is unchanged,
  stops at the first page with nothing new, and reads at most 5 pages per run, continuing older
  pages on later runs.
- **Link app sends by transaction ID.** `wallet_send_history` stores the transaction ID from the
  send response (the stored TxPoW ID is the pre-mined one and never matches the chain). The history
  API lists chain rows plus app sends that failed or are not on chain yet, so a send shows as
  pending at once and is replaced by its chain row without a duplicate.
- **Mark rows with a wallet fingerprint.** The fingerprint is a SHA-256 of the wallet's sorted
  canonical default addresses, cached until `runWalletReplacement()` finishes another replacement.
  Rows from another fingerprint are returned with `isPreviousWallet` and are kept. Rows are keyed by
  fingerprint, TxPoW, and token, so a payment between the old and new wallet keeps one row per wallet,
  each with its own direction, and a send is matched only to chain rows of the wallet that sent it.
- **Clearing is explicit and narrow.** Only previous-wallet rows can be deleted
  (`POST /api/wallet/history/clear-previous`), admin-only, rate-limited, and only after
  re-entering the current PIN/password, the same pattern as backup download. Current-wallet rows
  cannot be cleared because they would re-sync from Minima.
- **No automatic retention.** Wallet history is a financial record under the classification in
  ADR 0023, so it is never pruned automatically. Rows are roughly 300–400 bytes; the worst case is
  a payment workflow at the 1,000 runs/hour budget (ADR 0028), about 24k rows a day.
- **Confirmation time is the block's time.** `refreshPendingConfirmations()` checks up to 20
  unconfirmed rows per poll with `txpow onchain:`, then reads the block's TxPoW time with
  `txpow txpowid:<blockid>`. If the node no longer has the block's TxPoW (pruned, or not in a
  restored backup), the transaction's own TxPoW time is used, which is usually seconds earlier.
  Confirmation counts are computed at read time from the current tip.
- **Contact names are resolved by the backend.** Counterparties and contacts can use either the
  Mx or 0x address form, and matching needs Mx checksum decoding, so the API returns
  `counterpartyLabel` and search matches contact names on the server.

## Alternatives considered

- **Proxy `history` live on every request.** Rejected: history would disappear when Minima's
  TxPoW database is reset by a restore or resync, failed sends and send origin would have no home,
  and filtering and paging would require reading the whole history from RPC on every request.
- **Store raw TxPoW JSON, as the Minima Wallet MiniDapp does.** Rejected: several kilobytes per
  row for fields the UI never shows.
- **Delete history on wallet replacement.** Rejected: it silently destroys a financial record.
  Marking rows and letting an admin clear them keeps the decision with the operator.
- **Key rows by TxPoW and token only.** Rejected after Pi QA: restoring a backup of a wallet that had
  paid this one overwrote the old wallet's rows with the new wallet's view of the same TxPoWs.
- **Record the confirmation time as when the app first sees it.** Rejected after Pi QA: rows
  confirmed before the sync existed, or while the backend was down, showed a later time than the
  block, by up to hours.

## Consequences

- History survives Minima restores and resyncs, but rows synced before a restore stay even if the
  restored node no longer reports them.
- After a restore, confirmation times of older rows can be the transaction's time rather than the
  block's, because the restored node may not hold those blocks.
- Payments received while the backend is down appear on the next poll after it starts, as long as
  Minima still reports them.
- A wallet's history is identified by its default addresses. A replacement that keeps the same
  seed produces the same fingerprint, so its rows stay current.
- Each newly confirmed row costs one extra RPC call, bounded by the 20-row batch.
- Deferred to separate tickets: CSV export, running balance, day grouping, token-creation rows,
  incoming payments as an automation trigger, stuck-transaction detection, and backing up the app's
  SQLite database.

## Where this lives in code

- `backend/src/features/wallet/wallet-history.service.ts`: `syncWalletHistory()`,
  `syncWalletHistoryIfStale()`, `refreshPendingConfirmations()`, `getWalletFingerprint()`,
  `listWalletHistory()`, `clearPreviousWalletHistory()`.
- `backend/src/features/wallet/wallet.parse.ts`: `parseHistoryResponse()`,
  `parseHistorySizeResponse()`, `parseOnchainResponse()`, `parseTxPowTimeResponse()`.
- `backend/src/features/wallet/wallet.routes.ts`: `GET /api/wallet/history`,
  `POST /api/wallet/history/clear-previous`.
- `backend/src/features/minima/minima-poll.service.ts`: sync and confirmation refresh on each poll.
- `backend/src/features/address-book/wallet-replacement.service.ts`: `getWalletReplacementCount()`.
- `backend/src/shared/minima-address.ts`: `miniMinimaAddress()`.
- `backend/src/db/database.ts`: `wallet_transactions` and the new `wallet_send_history` columns.
- `frontend/src/features/wallet/`: `WalletHistoryPanel.tsx`, `HistoryDetailModal.tsx`,
  `ClearPreviousHistoryModal.tsx`, `walletHistory.ts`.
