import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const { getWalletStatusMock, runMinimaPathCommandMock } = vi.hoisted(() => ({
  getWalletStatusMock: vi.fn(),
  runMinimaPathCommandMock: vi.fn()
}));

vi.mock("../../../src/features/wallet/wallet.service.js", () => ({
  getWalletStatus: getWalletStatusMock
}));

vi.mock("../../../src/features/minima/minima.rpc.js", () => ({
  runMinimaPathCommand: runMinimaPathCommandMock
}));

let teardown: () => void;
let tokensService: typeof import("../../../src/features/tokens/tokens.service.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  tokensService = await import("../../../src/features/tokens/tokens.service.js");
});

afterAll(() => {
  teardown();
});

beforeEach(() => {
  getWalletStatusMock.mockReset();
  runMinimaPathCommandMock.mockReset();
});

function walletStatusWithNative(sendable: string) {
  return {
    checkedAt: new Date().toISOString(),
    tokens: [
      {
        tokenId: "0x00",
        name: "Minima",
        confirmed: sendable,
        unconfirmed: "0",
        sendable,
        isNative: true
      }
    ]
  };
}

describe("getTokenCreateRequirements", () => {
  it("returns the estimated cost and minimum balance constants", () => {
    const requirements = tokensService.getTokenCreateRequirements();
    assert.equal(requirements.estimatedMinimaCost, tokensService.TOKEN_CREATE_ESTIMATED_MINIMA);
    assert.equal(requirements.minimumAccountMinima, tokensService.TOKEN_CREATE_MIN_ACCOUNT_MINIMA);
    assert.ok(requirements.note.length > 0);
  });
});

describe("createCustomToken", () => {
  it("rejects a blank name", async () => {
    await assert.rejects(
      () => tokensService.createCustomToken({ name: "  ", amount: "10", decimal: 2 }),
      /name is required/
    );
  });

  it("rejects a non-positive amount", async () => {
    await assert.rejects(
      () => tokensService.createCustomToken({ name: "Foo", amount: "0", decimal: 2 }),
      /amount must be a positive number/
    );
  });

  it("rejects a non-finite amount", async () => {
    await assert.rejects(
      () => tokensService.createCustomToken({ name: "Foo", amount: "abc", decimal: 2 }),
      /amount must be a positive number/
    );
  });

  it("rejects a negative decimal", async () => {
    await assert.rejects(
      () => tokensService.createCustomToken({ name: "Foo", amount: "10", decimal: -1 }),
      /decimal must be a non-negative integer/
    );
  });

  it("rejects a non-integer decimal", async () => {
    await assert.rejects(
      () => tokensService.createCustomToken({ name: "Foo", amount: "10", decimal: 1.5 }),
      /decimal must be a non-negative integer/
    );
  });

  it("returns ok:false without calling Minima when sendable balance is insufficient", async () => {
    getWalletStatusMock.mockResolvedValue(walletStatusWithNative("0"));

    const result = await tokensService.createCustomToken({ name: "Foo", amount: "10", decimal: 2 });

    assert.equal(result.ok, false);
    assert.match(result.message ?? "", /Insufficient MINIMA/);
    assert.equal(runMinimaPathCommandMock.mock.calls.length, 0);
  });

  it("throws when the Minima RPC call fails", async () => {
    getWalletStatusMock.mockResolvedValue(walletStatusWithNative("1"));
    runMinimaPathCommandMock.mockResolvedValue({ ok: false, status: 500, source: "x", command: "x", body: {} });

    await assert.rejects(
      () => tokensService.createCustomToken({ name: "Foo", amount: "10", decimal: 2 }),
      /Minima RPC error: HTTP 500/
    );
  });

  it("returns a friendly message when Minima reports no spendable coins", async () => {
    getWalletStatusMock.mockResolvedValue(walletStatusWithNative("1"));
    runMinimaPathCommandMock.mockResolvedValue({
      ok: true,
      status: 200,
      source: "x",
      command: "x",
      body: { status: false, error: "No Minima Coins available for this transaction" }
    });

    const result = await tokensService.createCustomToken({ name: "Foo", amount: "10", decimal: 2 });

    assert.equal(result.ok, false);
    assert.match(result.message ?? "", /No spendable MINIMA coins available/);
  });

  it("returns the raw Minima error message for other failures", async () => {
    getWalletStatusMock.mockResolvedValue(walletStatusWithNative("1"));
    runMinimaPathCommandMock.mockResolvedValue({
      ok: true,
      status: 200,
      source: "x",
      command: "x",
      body: { status: false, error: "Invalid parameter : decimal" }
    });

    const result = await tokensService.createCustomToken({ name: "Foo", amount: "10", decimal: 2 });

    assert.equal(result.ok, false);
    assert.equal(result.message, "Invalid parameter : decimal");
  });

  it("creates and stores a token on success, quoting names with spaces", async () => {
    getWalletStatusMock.mockResolvedValue(walletStatusWithNative("1"));
    runMinimaPathCommandMock.mockResolvedValue({
      ok: true,
      status: 200,
      source: "x",
      command: "x",
      body: {
        status: true,
        response: {
          txpowid: "0xTXP1",
          body: {
            txn: {
              outputs: [
                {
                  tokenid: "0xNEWTOKEN",
                  token: { tokenid: "0xNEWTOKEN", name: { name: "My Token" } }
                }
              ]
            }
          }
        }
      }
    });

    const result = await tokensService.createCustomToken({ name: "My Token", amount: "10", decimal: 2 });

    assert.equal(result.ok, true);
    assert.equal(result.tokenId, "0xNEWTOKEN");
    assert.equal(result.txpowId, "0xTXP1");

    const [command] = runMinimaPathCommandMock.mock.calls[0] as [string, number];
    assert.match(command, /name:"My Token"/);

    const tokensRepository = await import("../../../src/features/tokens/tokens.repository.js");
    const stored = tokensRepository.getCustomTokenByTokenId("0xNEWTOKEN");
    assert.ok(stored);
    assert.equal(stored?.name, "My Token");
  });

  it("does not insert a duplicate row when the tokenId already exists locally", async () => {
    getWalletStatusMock.mockResolvedValue(walletStatusWithNative("1"));
    runMinimaPathCommandMock.mockResolvedValue({
      ok: true,
      status: 200,
      source: "x",
      command: "x",
      body: {
        status: true,
        response: {
          txpowid: "0xTXP2",
          body: {
            txn: {
              outputs: [
                {
                  tokenid: "0xDUPTOKEN",
                  token: { tokenid: "0xDUPTOKEN", name: { name: "Dup" } }
                }
              ]
            }
          }
        }
      }
    });

    await tokensService.createCustomToken({ name: "Dup", amount: "10", decimal: 2 });
    await tokensService.createCustomToken({ name: "Dup", amount: "10", decimal: 2 });

    const tokensRepository = await import("../../../src/features/tokens/tokens.repository.js");
    const rows = tokensRepository.listCustomTokens().filter((row) => row.token_id === "0xDUPTOKEN");
    assert.equal(rows.length, 1);
  });
});

describe("listWalletTokens", () => {
  it("excludes the native token and merges locally-stored names/decimals", async () => {
    getWalletStatusMock.mockResolvedValue({
      checkedAt: "2026-01-01T00:00:00.000Z",
      tokens: [
        { tokenId: "0x00", name: "Minima", confirmed: "5", unconfirmed: "0", sendable: "5", isNative: true },
        { tokenId: "0xMERGE", name: "RemoteName", confirmed: "1", unconfirmed: "0", sendable: "1", isNative: false }
      ]
    });

    const tokensRepository = await import("../../../src/features/tokens/tokens.repository.js");
    tokensRepository.insertCustomToken({
      tokenId: "0xMERGE",
      name: "LocalName",
      amount: "1",
      decimal: 3,
      txpowId: null
    });

    const result = await tokensService.listWalletTokens();

    assert.equal(result.tokens.length, 1);
    assert.equal(result.tokens[0].tokenId, "0xMERGE");
    assert.equal(result.tokens[0].name, "LocalName");
    assert.equal(result.tokens[0].decimal, 3);
    assert.equal(result.tokens[0].createdLocally, true);
  });

  it("falls back to the wallet-reported name when the token is not stored locally", async () => {
    getWalletStatusMock.mockResolvedValue({
      checkedAt: "2026-01-01T00:00:00.000Z",
      tokens: [
        { tokenId: "0xUNKNOWN", name: "RemoteOnly", confirmed: "1", unconfirmed: "0", sendable: "1", isNative: false }
      ]
    });

    const result = await tokensService.listWalletTokens();

    assert.equal(result.tokens[0].name, "RemoteOnly");
    assert.equal(result.tokens[0].createdLocally, false);
    assert.equal(result.tokens[0].decimal, undefined);
  });
});
