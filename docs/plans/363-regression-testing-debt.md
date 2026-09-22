# Regression Testing Debt Plan

**Status:** Not started  
**Created:** 2026-09-22  
**Goal:** Close the six remaining unit-test gaps tracked under OpenProject feature #363 so the behaviors they describe are pinned by tests, without changing any application behavior.

## Context

OpenProject feature **#363 Regression Testing Debt** (Integritas Team, parent *Testing & Engineering Quality*) collects the leftover unit-test gaps found while retiring the old PM-tool QA tickets. Its child tasks were written directly from `docs/plans/legacy-ticket-unit-test-gaps.md` — that doc is the upstream source of truth for *why* each gap is a gap; this doc is the branch-level execution plan for `feature/363-regression-testing-debt`.

Children:

| Ticket | Title | Status | Covered below |
|---|---|---|---|
| #213 | Workflow Rule Unit Testing | In progress | Step 1 |
| #218 | Devices Unit Testing | In progress | Steps 2-4 |
| #225 | Diagnostics Unit Testing | In progress | Step 5 (+ open question) |
| #242 | Integritas Unit Testing | In progress | Step 6 |
| #258 | Navigation & Route Regression | Done | Not in scope — see *Ticket state findings* |
| #287 | Wallet Security Unit Testing | In progress | Steps 7-8 |

### Audit findings (2026-09-22, against `feature/363-regression-testing-debt` @ `6ff998b`)

Every gap in the five open children was re-verified against the current tree. All still hold, but three of the tickets' stated premises have gone stale since they were written:

1. **`wallet.routes.test.ts` already exists.** #287 calls it "new". It exists with one test ("rejects a malformed prefix-matching recipient before calling sendPayment"). The import test is an addition to an existing file, not a new file.
2. **`frontend/tests/pages/DiagnosticsPage.test.tsx` already exists.** #225's open question rests on "no page under `frontend/src/pages/**` has one". Commit `6ff998b` (#229) added it, plus `DashboardPage`, `AutomationPage`, `DataSourcesPage`, `IntegritasPage`, `MinimaPage`, `UpdatePage`. The precedent argument in the ticket no longer applies — see *Open question* below.
3. **The "60% floor" in #363's acceptance criteria is well below reality.** Enforced thresholds are already far higher, and current coverage sits just above them:

   | Package | Thresholds (stmts/branch/func/lines) | Current |
   |---|---|---|
   | backend | 92 / 81 / 94 / 94 | 92.46 / 82.54 / 94.5 / 94.87 |
   | frontend | 90 / 89 / 87 / 92 | 90.73 / 89.6 / 87.59 / 92.33 |
   | update-agent | — | 98.78 / 93.71 / 97.7 / 99.73 |

   Margins are thin (backend statements +0.46, frontend lines +0.33), so any *source* change on this branch risks tripping a threshold. This branch is test-only, so that risk is near zero.

4. **Most of this branch's work will not move the coverage number at all, by design.** `*.routes.ts` is excluded from backend coverage and `src/pages/**` from frontend coverage, so Steps 4, 5, 6, 7, and 8 add zero measured coverage. The target modules that *are* measured are already high: `dataSources.service.ts` 97.1% lines, `mqttIngestion.service.ts` 100% lines / 81.25% branches, `gpioIngestion.service.ts` 97.1% lines / 83.05% branches. Treat the deliverable as *behavior pinned*, not *percentage moved* — consistent with `.claude/rules/testing.md` ("a line executing isn't the same as a test that would catch a bug").

### Ticket state findings (surface to the ticket owner, not code work)

- **#258 Navigation & Route Regression is `Done` / 100% with all six checklist items unticked.** Its checklist is a manual QA script (9 routes load, back/forward, deep links, refresh, unauthenticated redirect, 404 fallback), not the unit-test-gap format the other five children use, and it predates the plan doc. No code work is planned for it here. Worth confirming with whoever closed it whether it was closed on manual verification or by mistake.
- **#259 Node Failure Mode Unit Testing is orphaned from this branch.** It is the seventh gap section of `legacy-ticket-unit-test-gaps.md`, but it is parented under *Node Management* (status `Ready`), not under #363, and there is a separate sibling feature #356 *Node Testing* under *Testing & Engineering Quality*. Its four gaps (`MinimaContainerCard` stopped/exited/error states, `DashboardDevices` stopped/error pills and metric degradation, a new `MinimaPage.test.tsx` restart disable/re-enable + failure toast, and a `POST /api/minima/restart` route failure case) are **out of scope for this branch**. Note that `frontend/tests/pages/MinimaPage.test.tsx` now exists (commit `6ff998b`), so #259's third item needs re-verification before it is worked.

### Not gaps

`legacy-ticket-unit-test-gaps.md` records ten checklist items across these tickets that describe behavior the app does not implement (unsupported-file-type validation, a stamp retry control, a cached attestation list, wallet creation with passphrase, per-send passphrase/cancellation/double-send guards, unique-per-call addresses, an Operator role, a "degraded" node state, a node-logs diagnostics tab). Do not write tests against them. If a ticket checklist item below has no matching step here, that is why.

## Backend changes

### Step 1 — `sendHttpOutput` asserts the actual request (#213)

- File: `backend/tests/features/data-sources/dataSources.service.test.ts`, existing `describe("sendHttpOutput", ...)` block.
- The current success test asserts only `result.status` / `result.response`; the no-body test asserts `options.body === undefined`. Nothing checks the URL or the serialized payload, so a regression that posted the right shape to the wrong place would pass.
- Add one case for the normal `hasBody: true` success path asserting `fetchMock.mock.calls[0][0]` equals `config.url` and the parsed request body deep-equals the payload.
- Reuse the assertion style already used by `readJsonApiSource`'s tests in the same file.
- Verify: new case fails if `sendHttpOutput` is edited to post to a different URL or to send `{}`.

### Step 2 — MQTT client torn down after source deletion (#218)

- File: `backend/tests/features/data-sources/mqttIngestion.service.test.ts`.
- "ends the client when its workflow is disabled" proves the teardown mechanism works for the *disabled-workflow* trigger only. `DELETE /api/data-sources/:id` deletes the row and then calls `syncMqttDataSources()`; nothing proves that path ends the client.
- Add: seed an active client for a source, delete the source row from the test DB, call `syncMqttDataSources()` again, assert `end` was called on the client.
- Verify: new case fails if the deletion branch of `syncMqttDataSources()` is removed.

### Step 3 — GPIO watcher killed after source deletion (#218)

- File: `backend/tests/features/data-sources/gpioIngestion.service.test.ts`.
- Same gap as Step 2. The existing "skips processing when the source has been deleted" only asserts an in-flight edge event is ignored — it never re-calls `syncGpioDataSources()`, so the `gpiomon` child process is never proven dead. "kills the watcher when its workflow is disabled" covers the other trigger.
- Add: seed an active watcher, delete the source row, call `syncGpioDataSources()` again, assert `child.kill` was called (match the existing `SIGTERM` assertion style at `gpioIngestion.service.test.ts:183`).
- Verify: new case fails if the deletion branch is removed.

### Step 4 — Webhook receiver route tests (#218)

- File: new `backend/tests/features/data-sources/dataSources.routes.test.ts`.
- `dataSourcesWebhookRouter.post("/:token")` (`backend/src/features/data-sources/dataSources.routes.ts:19-36`) is only pinned as *public* by `app.401-smoke.test.ts:120`. Nothing drives it end to end.
- Follow the harness already used by `backend/tests/features/wallet/wallet.routes.test.ts`: `vi.mock` the service/repository modules and `auth.middleware.js`, `await import` the router, mount it on a bare `express()` with `express.json()`, drive it with `supertest`. No real server, no network.
- Cases: valid token + enabled workflow → 200 and the `{ item, workflow, result }` shape; unknown token → 404; valid token + no enabled workflow → 409 with `sourceId` in the details.
- Add a fourth case the ticket does not list but the handler has: a `WORKFLOW_COOLDOWN_ACTIVE` / `WORKFLOW_EVENT_INACTIVE` error from `recordPushAutomationPayload` → 202 `{ skipped: true }`.
- Verify: `npm --prefix backend run test -- dataSources.routes`.

### Step 5 — Integritas connection check (#242)

- File: new `backend/tests/features/status/statusRoutes.test.ts` (the only existing tests under `backend/tests/features/status/` are `device.service`, `docker.control`, `docker.service`).
- Goal: prove a 401/403 from Integritas produces `integritasConnected: false` on the status payload. The frontend half is already covered by `DashboardDevices.test.tsx`; nothing proves the backend actually yields that `false`.
- **Implementation constraint:** `getIntegritasConnectionCheck()` is module-private and memoizes into a module-level `integritasConnectionCache` with a one-hour TTL (`status.routes.ts:29-32`), with no exported reset. Drive it through the router and isolate cases with `vi.resetModules()` + a fresh `await import` per case, or `vi.useFakeTimers()` to step past `INTEGRITAS_CACHE_TTL_MS`. Do not export a reset helper just for the test — that would be a source change on a test-only branch.
- Mock `fetchJsonWithTimeout` and `getIntegritasApiKey`; cover a 401/403 response (`connected: false`, `status: "HTTP 401"`), a thrown/timeout error (`connected: false`, `status: "error"`), and a missing API key (`status: "missing_api_key"`).
- Cross-reference: this is **DS-05** in `docs/qa/gaps.md` ("Route tests — `status.routes.ts` authenticated 200, unauthenticated 401"). Tick DS-05 there only if this step also covers the authenticated-200 / unauthenticated-401 halves; otherwise leave DS-05 open and note what was covered, so retiring #242 does not silently drop it.

### Step 6 — Backup download/restore reauth rejection (#287)

- File: `backend/tests/features/minima/minima.routes.test.ts`.
- `verifyCurrentPassword` is unit-tested directly in `minima-backup.service.test.ts`, and both routes call it before touching the file. But the existing route tests only cover leak-prevention (the raw RPC command never reaching the response) — nothing sends a wrong `currentPassword` and asserts rejection.
- Add one case per route — `POST /api/minima/backups/:fileName/download` and `POST /api/minima/backups/restore` — with a valid session and a wrong `currentPassword`, asserting the 401 and that the file-read / restore mock was never called.
- Verify: new cases fail if the `verifyCurrentPassword` call is removed from either handler.

### Step 7 — Wallet import response carries no phrase (#287)

- File: `backend/tests/features/wallet/wallet.routes.test.ts` (**exists** — ticket says "new"; add to it).
- `POST /api/wallet/import` (`wallet.routes.ts:85-100`) never logs the phrase and `ImportWalletResult` has no phrase field, but nothing drives the route and inspects the JSON body for the submitted string.
- Add: POST a valid phrase, assert 200 and that `JSON.stringify(response.body)` does not contain the phrase substring. The file's existing mocks already stub `importWallet` and `requireRole`, so this is a case addition, not new scaffolding.
- Verify: new case fails if the handler is edited to echo `phrase` back.

## Frontend changes

### Step 8 — `diagnosticsQuery.ts` tests (#225)

- File: new `frontend/tests/pages/diagnosticsQuery.test.ts`.
- `frontend/src/pages/diagnosticsQuery.ts` (87 lines) is pure logic with zero tests — the same shape as `workflowHelpers.ts`, which has its own test file.
- Cover: `parseDiagnosticsTab` / `isValidDiagnosticsTab` falling back to `proofs` for invalid/missing tabs; `parseDiagnosticsListQuery` clamping out-of-range page/pageSize; status values rejected when outside the active tab's allowlist (`PROOF_STATUS_OPTIONS` / `READ_STATUS_OPTIONS` / `WORKFLOW_STATUS_OPTIONS`); `q` trimming and 200-char truncation; `diagnosticsSearchParams` round-tripping a query back to the same values.
- Note: `src/pages/**` is excluded from frontend coverage, so this adds no measured coverage. It is still the highest-value item in #225 — it is the logic behind every checklist item in that ticket.
- Verify: `npm --prefix frontend run test -- diagnosticsQuery`.

### Open question — page-level `DiagnosticsPage` tests (#225)

#225's second item asks for a decision, not an assumption. Its premise is now stale: `frontend/tests/pages/DiagnosticsPage.test.tsx` exists as of `6ff998b`, alongside six other page tests, so a page-level test here is no longer a first-of-its-kind precedent.

What the existing file covers: one case, "replaces failed history with a retryable error instead of an empty table". What #225 asks about and is still uncovered: tab-switching and pagination wiring.

**Recommendation:** add tab-switching and pagination cases to the existing `DiagnosticsPage.test.tsx` rather than treating this as a new decision — the error/`ErrorAlert` half is already done. Keep `src/pages/**` excluded from coverage; the exclusion is about not diluting the denominator with page shells, not a ban on page tests. **Confirm before implementing** — this is the one item in the branch that is a judgment call rather than a named gap.

## Docs

- `CHANGELOG.md`: **no entry.** This is test-only with no user- or operator-facing behavior change, per `docs/plans/legacy-ticket-unit-test-gaps.md` → Docs.
- `README.md` / `SECURITY.md`: no changes expected.
- `docs/qa/gaps.md`: tick **DS-05** only if Step 5 covers the authenticated-200 / unauthenticated-401 halves too; otherwise annotate what Step 5 did cover.
- `docs/TASKS.md`: remove the `## Next` line pointing at `docs/plans/legacy-ticket-unit-test-gaps.md` once Steps 1-8 land, and add the line for this plan (see below).
- `docs/SESSION.md`: note which OpenProject children were closed, and that #258 (closed with an unticked manual checklist) and #259 (orphaned under *Node Management*) were flagged rather than worked.
- `docs/plans/legacy-ticket-unit-test-gaps.md`: set **Status** to done for the six sections this branch closes; leave the *Node Failure Mode Testing* section open and point it at #259.

## Verification

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
```

Per-step, while iterating:

```bash
npm --prefix backend run test -- dataSources
npm --prefix backend run test -- minima.routes
npm --prefix backend run test -- wallet.routes
npm --prefix frontend run test -- diagnosticsQuery
```

Coverage must not regress below the enforced thresholds. These are additive tests only, so the expected outcome is flat-to-slightly-up on backend branch coverage (Steps 2-3 touch measured ingestion services) and flat everywhere else — Steps 4-7 hit coverage-excluded `*.routes.ts` and Step 8 hits coverage-excluded `src/pages/**`.

Before finishing:

```bash
git status --short --untracked-files=all
```

## Milestones

### Milestone 1: Measured-service gaps (#213, #218 teardown)

- [x] Step 1 — `sendHttpOutput` URL/body assertions.
- [x] Step 2 — MQTT client ended after source deletion.
- [ ] Step 3 — GPIO watcher killed after source deletion.

### Milestone 2: Route-level gaps (#218 webhook, #242, #287)

- [ ] Step 4 — webhook receiver route tests (200 / 404 / 409 / 202).
- [ ] Step 5 — Integritas connection check, with the module-cache isolation constraint handled.
- [ ] Step 6 — backup download/restore reauth rejection.
- [ ] Step 7 — wallet import response leak check.

### Milestone 3: Frontend + wrap-up (#225)

- [ ] Step 8 — `diagnosticsQuery.ts` tests.
- [ ] Open question resolved: `DiagnosticsPage` tab-switching/pagination cases, or an explicit decision not to add them.
- [ ] Docs reconciled (`docs/qa/gaps.md` DS-05, `docs/TASKS.md`, `docs/SESSION.md`, `legacy-ticket-unit-test-gaps.md`).
- [ ] #258 closure and #259 ownership raised with the ticket owner.
