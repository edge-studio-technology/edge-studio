import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";
import { LOCAL_ADDRESS, historyBody, historyCoin, historyTxpow, scriptsBody } from "../../helpers/minimaHistoryFixtures.js";

const { runMinimaPathCommandMock, replacementInProgressMock, replacementCountMock } = vi.hoisted(() => ({
  runMinimaPathCommandMock: vi.fn(), replacementInProgressMock: vi.fn(), replacementCountMock: vi.fn()
}));

vi.mock("../../../src/features/minima/minima.rpc.js", () => ({
  runMinimaPathCommand: runMinimaPathCommandMock
}));

vi.mock("../../../src/features/address-book/wallet-replacement.service.js", () => ({
  isWalletReplacementInProgress: replacementInProgressMock,
  getWalletReplacementCount: replacementCountMock
}));

// The Pi testnet peer's wallet address from the recorded fixture.
const SECOND_WALLET_ADDRESS = "0x276CAE92C5E18083A92BE0866B9784AF6417CD6F9F971B9688363FFC7FD4CDCE";
const SECOND_WALLET_MINIADDRESS = "MxG0817DWN95HF1G21QWAV0GPYPF15FCGBSQRSVWSDPD21M7VU7VY6DPQQD4673";
const SECOND_WALLET_SCRIPTS = { status: true, response: [
  { address: SECOND_WALLET_ADDRESS, miniaddress: SECOND_WALLET_MINIADDRESS, default: true, simple: true, track: true }
] };

let teardown: () => void;
let service: typeof import("../../../src/features/wallet/wallet-history.service.js");
let db: import("better-sqlite3").Database;
let chain: { txpow: unknown; difference: Record<string, string> }[];
let scripts: unknown;
let onchain: Record<string, unknown>;
let replacementCount = 0;
let tip: unknown;
let blocks: Record<string, unknown>;

function finishWalletReplacement() {
  replacementCount += 1;
}

function receivedItem(index: number) {
  const txpowid = `0x${index.toString(16).padStart(6, "0")}`;
  return {
    txpow: historyTxpow(txpowid, 1_700_000_000_000 - index, [], [historyCoin({ address: LOCAL_ADDRESS, amount: "1" })]),
    difference: { "0x00": "1" }
  };
}

function routeRpc(command: string) {
  if (command === "history action:size") return { ok: true, body: { status: true, response: { size: chain.length } } };
  if (command === "scripts") return { ok: true, body: scripts };
  if (command === "block") return { ok: true, body: tip };
  const page = /^history max:(\d+) offset:(\d+)$/.exec(command);
  if (page) {
    const offset = Number(page[2]);
    return { ok: true, body: historyBody(chain.slice(offset, offset + Number(page[1]))) };
  }
  const id = /^txpow onchain:(.+)$/.exec(command)?.[1];
  if (id) return { ok: true, body: { status: true, response: onchain[id] ?? { found: false } } };
  const blockId = /^txpow txpowid:(.+)$/.exec(command)?.[1];
  if (blockId) return { ok: true, body: blocks[blockId] ?? { status: false, error: "TxPoW not found" } };
  throw new Error(`unexpected command ${command}`);
}

function historyPageCalls() {
  return runMinimaPathCommandMock.mock.calls.map((call) => call[0] as string).filter((command) => command.startsWith("history max:"));
}

function storedRows() {
  return db.prepare("SELECT * FROM wallet_transactions ORDER BY time_millis DESC").all() as Record<string, unknown>[];
}

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  db = testDb.db;
  service = await import("../../../src/features/wallet/wallet-history.service.js");
});

afterAll(() => {
  teardown();
});

beforeEach(() => {
  db.prepare("DELETE FROM wallet_transactions").run();
  db.prepare("DELETE FROM wallet_send_history").run();
  db.prepare("DELETE FROM address_book").run();
  db.prepare("DELETE FROM settings WHERE key = 'wallet_history_sync_state'").run();
  finishWalletReplacement();
  chain = [];
  scripts = scriptsBody();
  onchain = {};
  blocks = {};
  tip = { status: true, response: { block: "100" } };
  replacementInProgressMock.mockReset().mockReturnValue(false);
  replacementCountMock.mockReset().mockImplementation(() => replacementCount);
  runMinimaPathCommandMock.mockReset().mockImplementation(async (command: string) => routeRpc(command));
});

describe("getWalletFingerprint", () => {
  it("hashes the sorted default addresses, so script order does not matter, and caches the result", async () => {
    const extra = SECOND_WALLET_SCRIPTS.response[0];
    scripts = scriptsBody([extra]);
    const first = await service.getWalletFingerprint();
    finishWalletReplacement();
    scripts = { status: true, response: [...(scriptsBody().response), extra].reverse() };
    assert.equal(await service.getWalletFingerprint(), first);
    assert.match(first, /^[0-9a-f]{64}$/);

    await service.getWalletFingerprint();
    assert.equal(runMinimaPathCommandMock.mock.calls.length, 2);
  });

  it("does not reuse a fingerprint read while a replacement was still running", async () => {
    runMinimaPathCommandMock.mockImplementation(async (command: string) => {
      const result = routeRpc(command);
      finishWalletReplacement();
      scripts = SECOND_WALLET_SCRIPTS;
      return result;
    });
    const stale = await service.getWalletFingerprint();
    runMinimaPathCommandMock.mockImplementation(async (command: string) => routeRpc(command));

    assert.notEqual(await service.getWalletFingerprint(), stale);
  });

  it("rejects a wallet with no default addresses", async () => {
    scripts = { status: true, response: [] };
    await assert.rejects(service.getWalletFingerprint(), /no default wallet addresses/);
  });
});

describe("syncWalletHistory", () => {
  it("stores the Pi-recorded history with direction, counterparty, and transaction ID", async () => {
    const recorded = JSON.parse(readFileSync(new URL("../../fixtures/minima-testnet-history.json", import.meta.url), "utf8"));
    const recordedTxpows = recorded.history.response.txpows as { txpowid: string }[];
    chain = recordedTxpows.map((txpow, index) => ({ txpow, difference: recorded.history.response.details[index].difference }));
    // The Pi wallet's tracked addresses; the first is a default address with its recorded Mx form.
    scripts = { status: true, response: [
      { address: recorded.localTrackedAddresses[0], miniaddress: "MxG087ZD0MTBK5CCCRYHZ5597ZSVQS9F1ERVUWYZCHACZRYTF3GUV6BUBKYAJAH", default: true, simple: true, track: true },
      ...recorded.localTrackedAddresses.slice(1).map((address: string) => ({ address, default: false, simple: true, track: true }))
    ] };

    await service.syncWalletHistory();

    const rows = storedRows();
    assert.deepEqual(rows.map((row) => [row.direction, row.amount]), [["self", "0"], ["out", "2.5"], ["in", "10"]]);
    const sent = rows.find((row) => row.direction === "out");
    assert.equal(sent?.transaction_id, recorded.sendOut.response.body.txn.transactionid);
    assert.equal(sent?.counterparty, SECOND_WALLET_MINIADDRESS);
    assert.equal(sent?.wallet_fingerprint, await service.getWalletFingerprint());
    assert.equal(sent?.confirmed_at, null);
  });

  it("makes one RPC call per tick when the history size has not changed", async () => {
    chain = [receivedItem(1), receivedItem(2)];
    await service.syncWalletHistory();
    runMinimaPathCommandMock.mockClear();

    await service.syncWalletHistory();

    assert.deepEqual(runMinimaPathCommandMock.mock.calls.map((call) => call[0]), ["history action:size"]);
  });

  it("pages newest-first and stops at the first page with nothing new", async () => {
    chain = Array.from({ length: 250 }, (_, index) => receivedItem(index + 1));
    await service.syncWalletHistory();
    chain = [receivedItem(0), ...chain];
    runMinimaPathCommandMock.mockClear();

    await service.syncWalletHistory();

    assert.deepEqual(historyPageCalls(), ["history max:100 offset:0", "history max:100 offset:100"]);
    assert.equal(storedRows().length, 251);
  });

  it("continues a capped first sync from where it stopped on the next tick", async () => {
    const pages = service.MAX_HISTORY_PAGES_PER_SYNC + 2;
    chain = Array.from({ length: (pages - 1) * service.HISTORY_PAGE_SIZE + 50 }, (_, index) => receivedItem(index + 1));

    await service.syncWalletHistory();
    assert.equal(storedRows().length, service.MAX_HISTORY_PAGES_PER_SYNC * service.HISTORY_PAGE_SIZE);
    runMinimaPathCommandMock.mockClear();

    await service.syncWalletHistory();

    assert.equal(storedRows().length, chain.length);
    assert.deepEqual(historyPageCalls(), ["history max:100 offset:0", "history max:100 offset:500", "history max:100 offset:600"]);
    runMinimaPathCommandMock.mockClear();
    await service.syncWalletHistory();
    assert.deepEqual(historyPageCalls(), []);
  });

  it("does not stop on a page that holds only malformed TxPoWs", async () => {
    const malformed = Array.from({ length: service.HISTORY_PAGE_SIZE }, () => ({ txpow: null, difference: { "0x00": "1" } }));
    chain = [...malformed, receivedItem(1)];

    await service.syncWalletHistory();

    assert.equal(storedRows().length, 1);
  });

  it("re-reads history under a new fingerprint after the wallet changes and keeps previous-wallet rows", async () => {
    chain = [receivedItem(1)];
    await service.syncWalletHistory();
    const firstFingerprint = await service.getWalletFingerprint();

    finishWalletReplacement();
    scripts = SECOND_WALLET_SCRIPTS;
    chain = [{
      txpow: historyTxpow("0x0000ff", 1_800_000_000_000, [], [historyCoin({ address: SECOND_WALLET_ADDRESS, amount: "4" })]),
      difference: { "0x00": "4" }
    }];
    await service.syncWalletHistory();

    const rows = storedRows();
    assert.equal(rows.length, 2);
    assert.equal(rows[0].txpow_id, "0x0000ff");
    assert.notEqual(rows[0].wallet_fingerprint, firstFingerprint);
    assert.equal(rows[1].wallet_fingerprint, firstFingerprint);
  });

  it("keeps each wallet's own row for a TxPoW both wallets took part in", async () => {
    chain = [receivedItem(1)];
    await service.syncWalletHistory();
    const firstFingerprint = await service.getWalletFingerprint();

    finishWalletReplacement();
    scripts = SECOND_WALLET_SCRIPTS;
    chain = [{
      txpow: historyTxpow("0x000001", 1_700_000_000_000 - 1,
        [historyCoin({ address: SECOND_WALLET_ADDRESS, amount: "1" })], [historyCoin({ address: LOCAL_ADDRESS, amount: "1" })]),
      difference: { "0x00": "-1" }
    }];
    await service.syncWalletHistory();

    const rows = db.prepare("SELECT wallet_fingerprint, direction FROM wallet_transactions WHERE txpow_id = '0x000001'").all() as
      { wallet_fingerprint: string; direction: string }[];
    assert.deepEqual(rows.map((row) => [row.wallet_fingerprint === firstFingerprint, row.direction]).sort(),
      [[false, "out"], [true, "in"]]);
  });

  it("keeps confirmation data when a known row is synced again", async () => {
    chain = [receivedItem(1)];
    await service.syncWalletHistory();
    db.prepare("UPDATE wallet_transactions SET block = 9, confirmations = 3, confirmed_at = 'then'").run();
    db.prepare("DELETE FROM settings WHERE key = 'wallet_history_sync_state'").run();

    await service.syncWalletHistory();

    assert.deepEqual([storedRows()[0].block, storedRows()[0].confirmed_at], [9, "then"]);
  });

  it("does nothing while the wallet is being replaced", async () => {
    replacementInProgressMock.mockReturnValue(true);
    await service.syncWalletHistory();
    assert.equal(runMinimaPathCommandMock.mock.calls.length, 0);
  });

  it("shares one run between overlapping calls", async () => {
    chain = [receivedItem(1)];
    await Promise.all([service.syncWalletHistory(), service.syncWalletHistory()]);
    assert.equal(runMinimaPathCommandMock.mock.calls.filter((call) => call[0] === "history action:size").length, 1);
  });

  it("logs and leaves stored rows and sync state untouched when an RPC call fails", async () => {
    chain = [receivedItem(1)];
    await service.syncWalletHistory();
    const state = db.prepare("SELECT value FROM settings WHERE key = 'wallet_history_sync_state'").get();
    chain = [receivedItem(0), ...chain];
    runMinimaPathCommandMock.mockImplementation(async (command: string) => {
      if (command.startsWith("history max:")) return { ok: true, body: { status: false, error: "boom" } };
      return routeRpc(command);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await service.syncWalletHistory();

    assert.equal(storedRows().length, 1);
    assert.deepEqual(db.prepare("SELECT value FROM settings WHERE key = 'wallet_history_sync_state'").get(), state);
    assert.match(String(errorSpy.mock.calls[0][1]), /successful history response/);
    errorSpy.mockRestore();
  });
});

describe("refreshPendingConfirmations", () => {
  it("confirms rows found on chain and leaves the rest pending", async () => {
    chain = [receivedItem(1), receivedItem(2)];
    await service.syncWalletHistory();
    onchain = { "0x000001": { found: true, block: "42", blockid: "0xB", tip: "44", confirmations: "3" } };
    blocks = { "0xB": { status: true, response: { txpowid: "0xB", header: { block: "42", timemilli: "1700000005000" } } } };

    await service.refreshPendingConfirmations();

    const [confirmed, pending] = storedRows();
    assert.deepEqual(
      [confirmed.block, confirmed.confirmations, confirmed.confirmed_at],
      [42, 3, new Date(1_700_000_005_000).toISOString()]
    );
    assert.equal(pending.confirmed_at, null);
  });

  it("falls back to the transaction's own time when the node no longer has the block", async () => {
    chain = [receivedItem(1)];
    await service.syncWalletHistory();
    onchain = { "0x000001": { found: true, block: "42", blockid: "0xB", tip: "44", confirmations: "3" } };

    await service.refreshPendingConfirmations();

    assert.deepEqual([storedRows()[0].block, storedRows()[0].confirmed_at], [42, new Date(1_700_000_000_000 - 1).toISOString()]);
  });

  it("leaves a row pending when the block lookup fails, and retries next time", async () => {
    chain = [receivedItem(1)];
    await service.syncWalletHistory();
    onchain = { "0x000001": { found: true, block: "42", blockid: "0xB", tip: "44", confirmations: "3" } };
    blocks = { "0xB": { status: true, response: { txpowid: "0xB", header: {} } } };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await service.refreshPendingConfirmations();

    assert.equal(storedRows()[0].confirmed_at, null);
    assert.match(String(errorSpy.mock.calls[0][1]), /requested TxPoW/);
    errorSpy.mockRestore();
    blocks = { "0xB": { status: true, response: { txpowid: "0xB", header: { timemilli: "1700000005000" } } } };

    await service.refreshPendingConfirmations();

    assert.equal(storedRows()[0].confirmed_at, new Date(1_700_000_005_000).toISOString());
  });

  it("only checks the current wallet's rows, in bounded batches, and skips non-hex IDs", async () => {
    chain = Array.from({ length: service.CONFIRMATION_BATCH_SIZE + 5 }, (_, index) => receivedItem(index + 1));
    await service.syncWalletHistory();
    db.prepare("UPDATE wallet_transactions SET wallet_fingerprint = 'old' WHERE txpow_id = '0x000001'").run();
    db.prepare("UPDATE wallet_transactions SET txpow_id = 'bad id' WHERE txpow_id = '0x000002'").run();
    runMinimaPathCommandMock.mockClear();

    await service.refreshPendingConfirmations();

    const checked = runMinimaPathCommandMock.mock.calls.map((call) => call[0] as string);
    assert.equal(checked.length, service.CONFIRMATION_BATCH_SIZE - 1);
    assert.ok(!checked.includes("txpow onchain:0x000001"));
  });

  it("does nothing while the wallet is being replaced", async () => {
    chain = [receivedItem(1)];
    await service.syncWalletHistory();
    replacementInProgressMock.mockReturnValue(true);
    runMinimaPathCommandMock.mockClear();

    await service.refreshPendingConfirmations();

    assert.equal(runMinimaPathCommandMock.mock.calls.length, 0);
  });

  it("logs and stops the batch when Minima fails", async () => {
    chain = [receivedItem(1), receivedItem(2)];
    await service.syncWalletHistory();
    runMinimaPathCommandMock.mockClear().mockResolvedValue({ ok: false, body: { status: false } });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await service.refreshPendingConfirmations();

    assert.equal(runMinimaPathCommandMock.mock.calls.length, 1);
    assert.ok(storedRows().every((row) => row.confirmed_at === null));
    assert.match(String(errorSpy.mock.calls[0][1]), /txpow onchain/);
    errorSpy.mockRestore();
  });
});

function insertChainRow(row: {
  txpowId: string; transactionId: string; direction?: string; amount?: string; timeMillis: number;
  block?: number | null; confirmedAt?: string | null; fingerprint: string; counterparty?: string | null; tokenName?: string;
}) {
  db.prepare(`
    INSERT INTO wallet_transactions (txpow_id, token_id, transaction_id, direction, amount, token_name, counterparty, time_millis,
      block, confirmed_at, wallet_fingerprint, synced_at)
    VALUES (?, '0x00', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'now')
  `).run(row.txpowId, row.transactionId, row.direction ?? "in", row.amount ?? "1", row.tokenName ?? "Minima", row.counterparty ?? null,
    row.timeMillis, row.block ?? null, row.confirmedAt ?? null, row.fingerprint);
}

function insertSendRow(row: {
  id: string; createdAt: string; status: "submitted" | "failed"; transactionId: string | null;
  fingerprint: string | null; origin?: string | null; error?: string | null;
}) {
  db.prepare(`
    INSERT INTO wallet_send_history (id, created_at, to_address, token_id, token_name, amount, txpow_id, status,
      wallet_fingerprint, origin, transaction_id, error)
    VALUES (?, ?, 'MxPEER', '0x00', 'Minima', '2', '0xPREMINED', ?, ?, ?, ?, ?)
  `).run(row.id, row.createdAt, row.status, row.fingerprint, row.origin ?? null, row.transactionId, row.error ?? null);
}

const PAGE = { page: 1, pageSize: 25 };

describe("listWalletHistory", () => {
  it("merges chain rows with unsynced and failed sends, newest first", async () => {
    const current = await service.getWalletFingerprint();
    insertChainRow({ txpowId: "0x0A", transactionId: "0xT1", direction: "out", timeMillis: 3_000, block: 90, confirmedAt: "c", fingerprint: current });
    insertSendRow({ id: "linked", createdAt: new Date(2_900).toISOString(), status: "submitted", transactionId: "0xT1", fingerprint: current, origin: "automation" });
    insertSendRow({ id: "unsynced", createdAt: new Date(4_000).toISOString(), status: "submitted", transactionId: "0xT2", fingerprint: current, origin: "manual" });
    insertSendRow({ id: "failed", createdAt: new Date(1_000).toISOString(), status: "failed", transactionId: null, fingerprint: current, origin: "manual", error: "Insufficient funds" });
    insertSendRow({ id: "legacy", createdAt: new Date(2_000).toISOString(), status: "submitted", transactionId: null, fingerprint: null });

    const { items, total } = await service.listWalletHistory(PAGE);

    assert.equal(total, 3);
    assert.deepEqual(items.map((item) => [item.id, item.status, item.direction, item.origin]), [
      ["unsynced", "pending", "out", "manual"],
      [`${current}:0x0A:0x00`, "confirmed", "out", "automation"],
      ["failed", "failed", "out", "manual"]
    ]);
    assert.deepEqual(items.map((item) => item.error), [null, null, "Insufficient funds"]);
    assert.deepEqual(items[0], {
      id: "unsynced", direction: "out", status: "pending", amount: "2", tokenId: "0x00", tokenName: "Minima",
      counterparty: "MxPEER", counterpartyLabel: null, time: new Date(4_000).toISOString(), txpowId: null, transactionId: "0xT2",
      block: null, confirmations: null, confirmedAt: null, origin: "manual", error: null, isPreviousWallet: false
    });
  });

  it("derives confirmations from the current tip and marks previous-wallet rows", async () => {
    const current = await service.getWalletFingerprint();
    insertChainRow({ txpowId: "0x0A", transactionId: "0xT1", timeMillis: 2_000, block: 97, confirmedAt: "c", fingerprint: current });
    insertChainRow({ txpowId: "0x0B", transactionId: "0xT2", timeMillis: 1_000, block: 100, confirmedAt: "c", fingerprint: "old" });
    insertSendRow({ id: "old-send", createdAt: new Date(500).toISOString(), status: "failed", transactionId: null, fingerprint: "old" });

    const { items, previousWalletItems } = await service.listWalletHistory(PAGE);

    assert.deepEqual(items.map((item) => [item.confirmations, item.isPreviousWallet]), [[3, false], [0, true], [null, true]]);
    assert.equal(previousWalletItems, 2);
  });

  it("matches sends to chain rows of the same wallet only", async () => {
    const current = await service.getWalletFingerprint();
    insertChainRow({ txpowId: "0x0A", transactionId: "0xT1", direction: "in", timeMillis: 2_000, fingerprint: "old" });
    insertSendRow({ id: "sent", createdAt: new Date(3_000).toISOString(), status: "submitted", transactionId: "0xT1", fingerprint: current, origin: "manual" });

    const { items } = await service.listWalletHistory(PAGE);

    assert.deepEqual(items.map((item) => [item.id, item.status, item.origin]), [
      ["sent", "pending", "manual"],
      ["old:0x0A:0x00", "pending", null]
    ]);
  });

  it("labels counterparties saved in the address book, matching Mx and 0x forms", async () => {
    const current = await service.getWalletFingerprint();
    db.prepare("INSERT INTO address_book (id, label, address, created_at) VALUES ('c1', 'Testnet peer', ?, 'now')").run(SECOND_WALLET_ADDRESS);
    insertChainRow({ txpowId: "0x0A", transactionId: "0xT1", timeMillis: 2_000, fingerprint: current, counterparty: SECOND_WALLET_MINIADDRESS });
    insertChainRow({ txpowId: "0x0B", transactionId: "0xT2", timeMillis: 1_000, fingerprint: current, counterparty: "MxUNKNOWN" });

    const { items } = await service.listWalletHistory(PAGE);

    assert.deepEqual(items.map((item) => item.counterpartyLabel), ["Testnet peer", null]);
  });

  it("finds rows by contact name, whichever address form the row and the contact use", async () => {
    const current = await service.getWalletFingerprint();
    db.prepare("INSERT INTO address_book (id, label, address, created_at) VALUES ('c1', 'Testnet peer', ?, 'now')").run(SECOND_WALLET_ADDRESS);
    insertChainRow({ txpowId: "0x0A", transactionId: "0xT1", timeMillis: 3_000, fingerprint: current, counterparty: SECOND_WALLET_MINIADDRESS });
    insertChainRow({ txpowId: "0x0B", transactionId: "0xT2", timeMillis: 2_000, fingerprint: current, counterparty: SECOND_WALLET_ADDRESS.toLowerCase() });
    insertChainRow({ txpowId: "0x0C", transactionId: "0xT3", timeMillis: 1_000, fingerprint: current, counterparty: "MxUNKNOWN" });

    const { items } = await service.listWalletHistory({ ...PAGE, q: "PEER" });

    assert.deepEqual(items.map((item) => item.txpowId), ["0x0A", "0x0B"]);
  });

  it("still lists stored rows when Minima is unreachable", async () => {
    insertChainRow({ txpowId: "0x0A", transactionId: "0xT1", timeMillis: 1_000, block: 97, confirmedAt: "c", fingerprint: "old" });
    runMinimaPathCommandMock.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const { items, previousWalletItems } = await service.listWalletHistory(PAGE);

    assert.deepEqual(items.map((item) => [item.confirmations, item.isPreviousWallet]), [[null, false]]);
    assert.equal(previousWalletItems, 0);
  });

  it("filters by status, direction, time range, and search text, and pages the result", async () => {
    const current = await service.getWalletFingerprint();
    insertChainRow({ txpowId: "0x0A", transactionId: "0xT1", direction: "in", timeMillis: 1_000, confirmedAt: "c", block: 1, fingerprint: current, counterparty: "MxALICE" });
    insertChainRow({ txpowId: "0x0B", transactionId: "0xT2", direction: "out", timeMillis: 2_000, fingerprint: current, counterparty: "MxBOB" });
    insertChainRow({ txpowId: "0x0C", transactionId: "0xT3", direction: "self", timeMillis: 3_000, confirmedAt: "c", block: 2, fingerprint: current });
    insertSendRow({ id: "failed", createdAt: new Date(4_000).toISOString(), status: "failed", transactionId: null, fingerprint: current });
    const ids = async (query: Partial<Parameters<typeof service.listWalletHistory>[0]>) =>
      (await service.listWalletHistory({ ...PAGE, ...query })).items.map((item) => item.txpowId ?? item.id);

    assert.deepEqual(await ids({ status: "pending" }), ["0x0B"]);
    assert.deepEqual(await ids({ status: "failed" }), ["failed"]);
    assert.deepEqual(await ids({ direction: "out" }), ["failed", "0x0B"]);
    assert.deepEqual(await ids({ fromMillis: 2_000, toMillis: 4_000 }), ["0x0C", "0x0B"]);
    assert.deepEqual(await ids({ q: "alice" }), ["0x0A"]);
    assert.deepEqual(await ids({ q: "0xT3" }), ["0x0C"]);
    assert.deepEqual(await ids({ q: "warehouse" }), []);
    const page = await service.listWalletHistory({ page: 2, pageSize: 3 });
    assert.deepEqual([page.total, page.items.map((item) => item.txpowId)], [4, ["0x0A"]]);
  });
});

describe("syncWalletHistoryIfStale", () => {
  it("skips the sync when one finished within the last few seconds", async () => {
    await service.syncWalletHistory();
    runMinimaPathCommandMock.mockClear();
    await service.syncWalletHistoryIfStale();
    assert.equal(runMinimaPathCommandMock.mock.calls.length, 0);

    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + service.READ_SYNC_MAX_AGE_MS);
    try {
      await service.syncWalletHistoryIfStale();
    } finally {
      clock.mockRestore();
    }
    assert.ok(runMinimaPathCommandMock.mock.calls.some((call) => call[0] === "history action:size"));
  });
});

describe("clearPreviousWalletHistory", () => {
  it("deletes only rows recorded under another wallet", async () => {
    const current = await service.getWalletFingerprint();
    insertChainRow({ txpowId: "0x0A", transactionId: "0xT1", timeMillis: 1, fingerprint: current });
    insertChainRow({ txpowId: "0x0B", transactionId: "0xT2", timeMillis: 2, fingerprint: "old" });
    insertSendRow({ id: "old", createdAt: "2026-01-01T00:00:00.000Z", status: "failed", transactionId: null, fingerprint: "old" });
    insertSendRow({ id: "legacy", createdAt: "2026-01-01T00:00:00.000Z", status: "failed", transactionId: null, fingerprint: null });
    insertSendRow({ id: "mine", createdAt: "2026-01-01T00:00:00.000Z", status: "failed", transactionId: null, fingerprint: current });

    assert.equal(await service.clearPreviousWalletHistory(), 2);

    assert.deepEqual(storedRows().map((row) => row.txpow_id), ["0x0A"]);
    assert.deepEqual(db.prepare("SELECT id FROM wallet_send_history ORDER BY id").all(), [{ id: "legacy" }, { id: "mine" }]);
  });

  it("refuses while a replacement is running or when one finished during the wallet read", async () => {
    insertChainRow({ txpowId: "0x0B", transactionId: "0xT2", timeMillis: 2, fingerprint: "old" });
    replacementInProgressMock.mockReturnValue(true);
    await assert.rejects(service.clearPreviousWalletHistory(), service.WalletReplacementBusyError);

    replacementInProgressMock.mockReturnValue(false);
    runMinimaPathCommandMock.mockImplementation(async (command: string) => {
      finishWalletReplacement();
      return routeRpc(command);
    });
    await assert.rejects(service.clearPreviousWalletHistory(), service.WalletReplacementBusyError);
    assert.equal(storedRows().length, 1);
  });
});
