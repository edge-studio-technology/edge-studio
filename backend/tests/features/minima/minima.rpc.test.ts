import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { fetchMinimaStatus, runMinimaPathCommand } from "../../../src/features/minima/minima.rpc.js";
import { parseBalanceResponse, parseHistoryResponse, parseLocalWalletAddressesResponse } from "../../../src/features/wallet/wallet.parse.js";
import { EXTERNAL_ADDRESS, EXTERNAL_MINIADDRESS, LOCAL_ADDRESS, TOKEN_ID, historyBody, historyCoin, historyTxpow } from "../../helpers/minimaHistoryFixtures.js";
import { parseTokenCreateResponse } from "../../../src/features/tokens/tokens.parse.js";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockResponse(status: number, bodyText: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => bodyText
  };
}

describe("fetchMinimaStatus", () => {
  it("fetches the configured status URL and returns the parsed body", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ status: true, response: { chain: {} } })));

    const result = await fetchMinimaStatus();

    assert.equal(fetchMock.mock.calls[0][0], "http://127.0.0.1:9005/status");
    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    assert.equal(result.command, "status");
    assert.deepEqual(result.body, { status: true, response: { chain: {} } });
  });

  it("reports ok:false for a non-2xx response", async () => {
    fetchMock.mockResolvedValue(mockResponse(503, "Service Unavailable"));

    const result = await fetchMinimaStatus();

    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.equal(result.body, "Service Unavailable");
  });
});

describe("runMinimaPathCommand", () => {
  it("preserves default/simple address data through the scripts RPC and parser", async () => {
    // Source-shaped fixture; deployed-node capture remains part of ticket #206 verification.
    const miniaddress = "MxG086U24F17MT50Y6VUPBPD6VJKTYVMR71WRSYURYUVZDN1VMG25FF39M0458A";
    const body = { status: true, response: [{
      script: "RETURN SIGNEDBY(0xABCD)",
      address: "0xDE111E13DBA5054DFF657969BF3A76BFB6CE196F95F6EBEFE1B70FED0115EF1A",
      miniaddress, default: true, simple: true, publickey: "0xABCD", track: true
    }] };
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify(body)));

    const result = await runMinimaPathCommand("scripts");

    assert.equal(fetchMock.mock.calls[0][0], "http://127.0.0.1:9005/scripts");
    assert.equal(result.ok, true);
    assert.deepEqual(parseLocalWalletAddressesResponse(result.body), [miniaddress]);
  });

  it("builds the request path from a simple command", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ status: true })));

    const result = await runMinimaPathCommand("peers");

    assert.equal(fetchMock.mock.calls[0][0], "http://127.0.0.1:9005/peers");
    assert.equal(result.command, "peers");
  });

  it("percent-encodes a command with spaces and colons into a single path segment", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ status: true })));

    const command = "megammrsync action:resync host:megammr.minima.global:9001";
    await runMinimaPathCommand(command);

    const requestedUrl = fetchMock.mock.calls[0][0] as string;
    assert.equal(requestedUrl, `http://127.0.0.1:9005/${encodeURIComponent(command)}`);
    assert.ok(!requestedUrl.includes(" "));
  });
});

// The feature-level wallet/token suites mock minima.rpc.js wholesale, so nothing there ever
// runs the redaction the RPC layer applies to a response body. These pipe a recorded Minima
// body through the real runMinimaPathCommand and into the real parsers, which is where a
// redaction rule that is too broad shows up as corrupted data rather than as a leak.
describe("response body redaction against recorded Minima bodies", () => {
  it("leaves a balance response parseable — token ids and names survive", async () => {
    const body = {
      status: true,
      response: [
        { token: "Minima", tokenid: "0x00", confirmed: "1000", unconfirmed: "0", sendable: "1000", coins: "3" },
        { token: { name: "MyToken", description: "d" }, tokenid: "0xFEED", confirmed: "5", unconfirmed: "0", sendable: "5", coins: "1" }
      ]
    };
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify(body)));

    const result = await runMinimaPathCommand("balance");
    const parsed = parseBalanceResponse(result.body);

    assert.equal(parsed.tokens.length, 2);
    assert.equal(parsed.tokens[0].tokenId, "0x00");
    assert.equal(parsed.tokens[0].isNative, true);
    assert.equal(parsed.tokens[0].name, "Minima");
    assert.equal(parsed.tokens[1].tokenId, "0xFEED");
    assert.equal(parsed.tokens[1].name, "MyToken");
  });

  it("leaves a tokencreate response parseable — the new token id survives", async () => {
    const body = { status: true, response: { txpowid: "0xTX", body: { txn: { outputs: [{ token: { tokenid: "0xNEW", name: "MyToken" } }] } } } };
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify(body)));

    const result = await runMinimaPathCommand("tokencreate name:MyToken amount:10 decimals:8");
    const parsed = parseTokenCreateResponse(result.body);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.tokenId, "0xNEW");
  });

  it("leaves a history response parseable — token ids, names, and addresses survive", async () => {
    const txpow = historyTxpow("0xIN", 1_700_000_000_000,
      [historyCoin({ address: EXTERNAL_ADDRESS, amount: "3", tokenid: TOKEN_ID, tokenName: { name: "Gold" } })],
      [historyCoin({ address: LOCAL_ADDRESS, amount: "3", tokenid: TOKEN_ID, tokenName: { name: "Gold" } })]);
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify(historyBody([{ txpow, difference: { [TOKEN_ID]: "3" } }]))));

    const result = await runMinimaPathCommand("history max:100 offset:0");
    const [entry] = parseHistoryResponse(result.body, new Set([LOCAL_ADDRESS.toLowerCase()]));

    assert.equal(entry.tokenId, TOKEN_ID);
    assert.equal(entry.tokenName, "Gold");
    assert.equal(entry.direction, "in");
    assert.equal(entry.counterparty, EXTERNAL_MINIADDRESS);
  });

  it("still redacts a secret echoed back inside the response body", async () => {
    const command = 'backup file:backups/a.bak password:"echo-me-not"';
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ status: true, params: { command } })));

    const result = await runMinimaPathCommand(command);

    assert.equal(JSON.stringify(result.body).includes("echo-me-not"), false);
  });
});
