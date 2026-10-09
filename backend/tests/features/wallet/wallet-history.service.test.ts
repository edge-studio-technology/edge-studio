import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";
import { LOCAL_ADDRESS, historyBody, historyCoin, historyTxpow, scriptsBody } from "../../helpers/minimaHistoryFixtures.js";

const { runMinimaPathCommandMock, replacementInProgressMock } = vi.hoisted(() => ({
  runMinimaPathCommandMock: vi.fn(), replacementInProgressMock: vi.fn()
}));

vi.mock("../../../src/features/minima/minima.rpc.js", () => ({
  runMinimaPathCommand: runMinimaPathCommandMock
}));

vi.mock("../../../src/features/address-book/wallet-replacement.service.js", () => ({
  isWalletReplacementInProgress: replacementInProgressMock
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
  const page = /^history max:(\d+) offset:(\d+)$/.exec(command);
  if (page) {
    const offset = Number(page[2]);
    return { ok: true, body: historyBody(chain.slice(offset, offset + Number(page[1]))) };
  }
  const id = /^txpow onchain:(.+)$/.exec(command)?.[1];
  if (id) return { ok: true, body: { status: true, response: onchain[id] ?? { found: false } } };
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
  db.prepare("DELETE FROM settings WHERE key = 'wallet_history_sync_state'").run();
  service.invalidateWalletFingerprint();
  chain = [];
  scripts = scriptsBody();
  onchain = {};
  replacementInProgressMock.mockReset().mockReturnValue(false);
  runMinimaPathCommandMock.mockReset().mockImplementation(async (command: string) => routeRpc(command));
});

describe("getWalletFingerprint", () => {
  it("hashes the sorted default addresses, so script order does not matter, and caches the result", async () => {
    const extra = SECOND_WALLET_SCRIPTS.response[0];
    scripts = scriptsBody([extra]);
    const first = await service.getWalletFingerprint();
    service.invalidateWalletFingerprint();
    scripts = { status: true, response: [...(scriptsBody().response), extra].reverse() };
    assert.equal(await service.getWalletFingerprint(), first);
    assert.match(first, /^[0-9a-f]{64}$/);

    await service.getWalletFingerprint();
    assert.equal(runMinimaPathCommandMock.mock.calls.length, 2);
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

    service.invalidateWalletFingerprint();
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

    await service.refreshPendingConfirmations();

    const [confirmed, pending] = storedRows();
    assert.deepEqual([confirmed.block, confirmed.confirmations], [42, 3]);
    assert.ok(confirmed.confirmed_at);
    assert.equal(pending.confirmed_at, null);
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
