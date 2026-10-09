import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import {
  isTxPowId,
  parseAddressResponse,
  parseBalanceResponse,
  parseHistoryResponse,
  parseHistorySizeResponse,
  parseImportResponse,
  parseLocalWalletAddressesResponse,
  parseOnchainResponse,
  parseTxPowTimeResponse,
  parsePaymentStatusResponse,
  parseSendResponse,
  parseTrackedScriptAddressesResponse
} from "../../../src/features/wallet/wallet.parse.js";
import {
  EXTERNAL_ADDRESS,
  EXTERNAL_MINIADDRESS,
  LOCAL_ADDRESS,
  TOKEN_ID,
  historyBody,
  historyCoin,
  historyTxpow,
  scriptsBody
} from "../../helpers/minimaHistoryFixtures.js";

const LOCAL_SCRIPT = {
  address: "0xDE111E13DBA5054DFF657969BF3A76BFB6CE196F95F6EBEFE1B70FED0115EF1A",
  miniaddress: "MxG086U24F17MT50Y6VUPBPD6VJKTYVMR71WRSYURYUVZDN1VMG25FF39M0458A",
  default: true,
  simple: true,
  track: true,
  script: "RETURN SIGNEDBY(0xABCD)",
  publickey: "0xABCD"
};

describe("parseLocalWalletAddressesResponse", () => {
  it("projects only default/simple public destinations, ignoring merely tracked scripts", () => {
    assert.deepEqual(parseLocalWalletAddressesResponse({ status: true, response: [
      { ...LOCAL_SCRIPT, default: false },
      { ...LOCAL_SCRIPT, simple: false },
      LOCAL_SCRIPT
    ] }), [LOCAL_SCRIPT.miniaddress]);
  });

  it("accepts case/whitespace aliases and a successful empty pool", () => {
    assert.deepEqual(parseLocalWalletAddressesResponse({ status: true, response: [{
      ...LOCAL_SCRIPT, address: ` ${LOCAL_SCRIPT.address.toLowerCase()} `,
      miniaddress: ` ${LOCAL_SCRIPT.miniaddress.toLowerCase()} `
    }] }), [LOCAL_SCRIPT.miniaddress.toLowerCase()]);
    assert.deepEqual(parseLocalWalletAddressesResponse({ status: true, response: [] }), []);
  });

  it("requires explicit RPC success and an array, even if a failure includes addresses", () => {
    for (const body of [null, [], {}, { response: [LOCAL_SCRIPT] },
      { status: false, response: [LOCAL_SCRIPT] }, { status: "true", response: [LOCAL_SCRIPT] },
      { status: true, response: LOCAL_SCRIPT }]) {
      assert.throws(() => parseLocalWalletAddressesResponse(body), /successful scripts response/);
    }
  });

  it("rejects malformed rows and flags rather than silently accepting an incomplete pool", () => {
    for (const row of [null, [], { ...LOCAL_SCRIPT, default: 1 },
      { ...LOCAL_SCRIPT, simple: "true" }, { address: LOCAL_SCRIPT.address }]) {
      assert.throws(() => parseLocalWalletAddressesResponse({ status: true, response: [LOCAL_SCRIPT, row] }), /malformed script flags/);
    }
  });

  it("rejects missing, invalid, checksum-corrupted, or mismatched address pairs", () => {
    for (const fields of [
      { address: null }, { address: "0x" }, { miniaddress: null }, { miniaddress: "Mx1234" },
      { miniaddress: `${LOCAL_SCRIPT.miniaddress.slice(0, -1)}B` },
      { address: "0x01" }, { address: LOCAL_SCRIPT.miniaddress }, { miniaddress: LOCAL_SCRIPT.address }
    ]) {
      assert.throws(() => parseLocalWalletAddressesResponse({ status: true, response: [{ ...LOCAL_SCRIPT, ...fields }] }), /invalid local wallet address data/);
    }
  });
});

describe("parseBalanceResponse", () => {
  it("returns an empty token list when response is not an array", () => {
    const result = parseBalanceResponse({ response: "not-an-array" });
    assert.deepEqual(result.tokens, []);
    assert.ok(result.checkedAt);
  });

  it("names the native token Minima regardless of the token field", () => {
    const result = parseBalanceResponse({ response: [{ tokenid: "0x00", token: "ignored", confirmed: "5", unconfirmed: "0", sendable: "5" }] });
    assert.equal(result.tokens[0].name, "Minima");
    assert.equal(result.tokens[0].isNative, true);
  });

  it("uses a string token name for custom tokens", () => {
    const result = parseBalanceResponse({ response: [{ tokenid: "0xabc", token: "MyToken" }] });
    assert.equal(result.tokens[0].name, "MyToken");
    assert.equal(result.tokens[0].isNative, false);
  });

  it("extracts the name from custom-token metadata objects", () => {
    const result = parseBalanceResponse({ response: [{ tokenid: "0xabc", token: { name: "MetaToken", description: "d" } }] });
    assert.equal(result.tokens[0].name, "MetaToken");
  });

  it("falls back to the tokenId when metadata has no usable name", () => {
    const result = parseBalanceResponse({ response: [{ tokenid: "0xabc", token: { description: "d" } }] });
    assert.equal(result.tokens[0].name, "0xabc");
  });

  it("falls back to the tokenId when the token field is missing entirely", () => {
    const result = parseBalanceResponse({ response: [{ tokenid: "0xabc" }] });
    assert.equal(result.tokens[0].name, "0xabc");
  });

  it("skips entries without a tokenid", () => {
    const result = parseBalanceResponse({ response: [{ token: "NoId" }, { tokenid: "0x00" }] });
    assert.equal(result.tokens.length, 1);
    assert.equal(result.tokens[0].tokenId, "0x00");
  });

  it("defaults confirmed/unconfirmed/sendable to '0' when missing", () => {
    const result = parseBalanceResponse({ response: [{ tokenid: "0x00" }] });
    assert.equal(result.tokens[0].confirmed, "0");
    assert.equal(result.tokens[0].unconfirmed, "0");
    assert.equal(result.tokens[0].sendable, "0");
  });
});

describe("parseAddressResponse", () => {
  it("prefers miniaddress and address fields when both present", () => {
    const result = parseAddressResponse({ response: { miniaddress: "MxABC", address: "0xdef", publickey: "pub" } });
    assert.equal(result.miniAddress, "MxABC");
    assert.equal(result.address, "0xdef");
    assert.equal(result.publicKey, "pub");
  });

  it("falls back address to miniaddress when address is missing", () => {
    const result = parseAddressResponse({ response: { miniaddress: "MxABC" } });
    assert.equal(result.miniAddress, "MxABC");
    assert.equal(result.address, "MxABC");
  });

  it("falls back miniAddress to address when miniaddress is missing", () => {
    const result = parseAddressResponse({ response: { address: "0xdef" } });
    assert.equal(result.miniAddress, "0xdef");
    assert.equal(result.address, "0xdef");
  });

  it("throws when neither field is present", () => {
    assert.throws(() => parseAddressResponse({ response: {} }), /did not return an address/);
  });

  it("leaves publicKey undefined when not a string", () => {
    const result = parseAddressResponse({ response: { address: "0xdef", publickey: 123 } });
    assert.equal(result.publicKey, undefined);
  });
});

describe("parseSendResponse", () => {
  it("returns a failed result with the error message when status is false", () => {
    const result = parseSendResponse({ status: false, error: "insufficient funds" });
    assert.equal(result.ok, false);
    assert.equal(result.status, "failed");
    assert.equal(result.txpowId, null);
    assert.equal(result.message, "insufficient funds");
  });

  it("falls back to message field, then a default, when error is missing", () => {
    const withMessage = parseSendResponse({ status: false, message: "custom message" });
    assert.equal(withMessage.message, "custom message");

    const withNeither = parseSendResponse({ status: false });
    assert.equal(withNeither.message, "Send failed");
  });

  it("extracts txpowid from the top-level response on success", () => {
    const result = parseSendResponse({ response: { txpowid: "tx-1" } });
    assert.equal(result.ok, true);
    assert.equal(result.status, "pending");
    assert.equal(result.txpowId, "tx-1");
  });

  it("falls back to the nested txpow.txpowid when the top-level id is missing", () => {
    const result = parseSendResponse({ response: { txpow: { txpowid: "tx-nested" } } });
    assert.equal(result.txpowId, "tx-nested");
  });

  it("returns null txpowId when neither location has an id", () => {
    const result = parseSendResponse({ response: {} });
    assert.equal(result.txpowId, null);
    assert.equal(result.transactionId, null);
  });

  it("returns the transaction ID, which survives mining, from a Pi-recorded send", () => {
    const recorded = JSON.parse(readFileSync(new URL("../../fixtures/minima-testnet-history.json", import.meta.url), "utf8"));
    const result = parseSendResponse(recorded.sendOut);
    assert.equal(result.txpowId, recorded.sendOut.response.txpowid);
    assert.equal(result.transactionId, "0x67D843B5988652A30EF0709E70913C93D3BB43FF29D1A462B4865E932A836F0A");
    assert.equal(parseSendResponse({ response: { txpow: { body: { txn: { transactionid: "0xAB" } } } } }).transactionId, "0xAB");
  });
});

describe("isTxPowId", () => {
  it("accepts 0x hex only", () => {
    assert.equal(isTxPowId("0xAB12"), true);
    for (const value of ["", "0x", "AB12", "0xZZ", "0x12 max:1", `0x${"a".repeat(129)}`]) {
      assert.equal(isTxPowId(value), false, value);
    }
  });
});

describe("parsePaymentStatusResponse", () => {
  it("returns pending when Minima returns the TxPoW itself as the response", () => {
    const result = parsePaymentStatusResponse({ status: true, response: { txpowid: "0xAB", isblock: false } }, "0xab");
    assert.equal(result.status, "pending");
    assert.equal(result.txpowId, "0xab");
    assert.ok(result.checkedAt);
  });

  it("returns unknown for failures, missing responses, and a different TxPoW", () => {
    for (const body of [null, { status: false, error: "TxPoW not found : 0xAB" }, { status: true },
      { response: { txpowid: "0xAB" } }, { status: true, response: { txpowid: "0xCD" } },
      { status: true, response: { txpow: { txpowid: "0xAB" } } }]) {
      assert.equal(parsePaymentStatusResponse(body, "0xAB").status, "unknown");
    }
  });
});

describe("parseTxPowTimeResponse", () => {
  it("returns the header time of the requested TxPoW", () => {
    const body = { status: true, response: { txpowid: "0xAB", header: { block: "381", timemilli: "1791542341688" } } };
    assert.equal(parseTxPowTimeResponse(body, "0xab"), 1_791_542_341_688);
  });

  it("rejects failures, another TxPoW, and a missing or malformed time", () => {
    for (const body of [
      { status: false, error: "not found" },
      { status: true, response: { txpowid: "0xCD", header: { timemilli: "1" } } },
      { status: true, response: { txpowid: "0xAB", header: {} } },
      { status: true, response: { txpowid: "0xAB", header: { timemilli: "soon" } } },
      { status: true, response: { txpowid: "0xAB" } }
    ]) {
      assert.throws(() => parseTxPowTimeResponse(body, "0xAB"), /requested TxPoW/);
    }
  });
});

describe("parseOnchainResponse", () => {
  it("returns found:false when the TxPoW is not on chain", () => {
    assert.deepEqual(parseOnchainResponse({ status: true, response: { found: false } }), { found: false });
  });

  it("parses Minima's string block numbers and confirmations", () => {
    assert.deepEqual(parseOnchainResponse({ status: true, response: {
      found: true, block: "1200", blockid: "0xB10C", tip: "1203", confirmations: "3"
    } }), { found: true, block: 1200, blockId: "0xB10C", confirmations: 3 });
  });

  it("throws on failed or malformed responses", () => {
    for (const body of [null, { status: false }, { status: true }, { status: true, response: { found: "true" } }]) {
      assert.throws(() => parseOnchainResponse(body), /successful txpow onchain response/);
    }
    for (const response of [{ found: true, block: "x", blockid: "0x1", confirmations: "1" },
      { found: true, block: "1", blockid: "", confirmations: "1" },
      { found: true, block: "1", blockid: "0x1", confirmations: "-1" }]) {
      assert.throws(() => parseOnchainResponse({ status: true, response }), /malformed txpow onchain data/);
    }
  });
});

describe("parseHistorySizeResponse", () => {
  it("returns the relevant TxPoW count", () => {
    assert.equal(parseHistorySizeResponse({ status: true, response: { size: 42 } }), 42);
    assert.equal(parseHistorySizeResponse({ status: true, response: { size: 0 } }), 0);
  });

  it("throws on failed or malformed responses", () => {
    for (const body of [null, { status: false, response: { size: 1 } }, { status: true, response: {} },
      { status: true, response: { size: -1 } }, { status: true, response: { size: 1.5 } }]) {
      assert.throws(() => parseHistorySizeResponse(body), /successful history size response/);
    }
  });
});

describe("parseTrackedScriptAddressesResponse", () => {
  it("returns canonical addresses of tracked scripts only, including non-default ones", () => {
    const addresses = parseTrackedScriptAddressesResponse(scriptsBody([
      { address: "0xAAAA", miniaddress: "MxA", default: false, simple: false, track: true },
      { address: "0xBBBB", miniaddress: "MxB", default: false, simple: true, track: false },
      { address: 7, track: true }
    ]));
    assert.deepEqual([...addresses].sort(), ["0xaaaa", LOCAL_ADDRESS.toLowerCase()]);
  });

  it("throws on a failed scripts response", () => {
    assert.throws(() => parseTrackedScriptAddressesResponse({ status: false }), /successful scripts response/);
  });
});

describe("parseHistoryResponse", () => {
  const local = new Set([LOCAL_ADDRESS.toLowerCase()]);

  it("derives direction from the sign of difference and the counterparty from the other side", () => {
    const received = historyTxpow("0xIN", 1_700_000_000_000,
      [historyCoin({ address: EXTERNAL_ADDRESS, amount: "15" })],
      [historyCoin({ address: LOCAL_ADDRESS, amount: "10" }), historyCoin({ address: EXTERNAL_ADDRESS, amount: "5" })]);
    const sent = historyTxpow("0xOUT", 1_700_000_100_000,
      [historyCoin({ address: LOCAL_ADDRESS, amount: "20" })],
      [historyCoin({ address: LOCAL_ADDRESS, amount: "17.5" }), historyCoin({ address: EXTERNAL_ADDRESS, amount: "2.5" })]);
    const self = historyTxpow("0xSELF", 1_700_000_200_000,
      [historyCoin({ address: LOCAL_ADDRESS, amount: "5" })],
      [historyCoin({ address: LOCAL_ADDRESS, amount: "5" })]);

    const entries = parseHistoryResponse(historyBody([
      { txpow: sent, difference: { "0x00": "-2.5" } },
      { txpow: received, difference: { "0x00": "10" } },
      { txpow: self, difference: { "0x00": "0" } }
    ]), local);

    assert.deepEqual(entries, [
      { txpowId: "0xOUT", transactionId: "0x02", tokenId: "0x00", tokenName: "Minima", amount: "2.5", direction: "out", timeMillis: 1_700_000_100_000, counterparty: EXTERNAL_MINIADDRESS },
      { txpowId: "0xIN", transactionId: "0x02", tokenId: "0x00", tokenName: "Minima", amount: "10", direction: "in", timeMillis: 1_700_000_000_000, counterparty: EXTERNAL_MINIADDRESS },
      { txpowId: "0xSELF", transactionId: "0x02", tokenId: "0x00", tokenName: "Minima", amount: "0", direction: "self", timeMillis: 1_700_000_200_000, counterparty: null }
    ]);
  });

  it("emits one entry per token and resolves custom token names from string or metadata names", () => {
    const txpow = historyTxpow("0xMULTI", 1_700_000_000_000,
      [historyCoin({ address: EXTERNAL_ADDRESS, amount: "3", tokenid: TOKEN_ID, tokenName: { name: " Gold ", url: "x" } }),
        historyCoin({ address: EXTERNAL_ADDRESS, amount: "1" })],
      [historyCoin({ address: LOCAL_ADDRESS, amount: "3", tokenid: TOKEN_ID, tokenName: { name: " Gold ", url: "x" } }),
        historyCoin({ address: LOCAL_ADDRESS, amount: "1" })]);
    const plain = historyTxpow("0xPLAIN", 1, [], [historyCoin({ address: LOCAL_ADDRESS, amount: "1", tokenid: "0xCC", tokenName: "Silver" })]);
    const unnamed = historyTxpow("0xUNNAMED", 1, [], []);

    const entries = parseHistoryResponse(historyBody([
      { txpow, difference: { [TOKEN_ID]: "3", "0x00": "1" } },
      { txpow: plain, difference: { "0xCC": "1" } },
      { txpow: unnamed, difference: { "0xDD": "1" } }
    ]), local);

    assert.deepEqual(entries.map((entry) => [entry.txpowId, entry.tokenId, entry.tokenName]), [
      ["0xMULTI", TOKEN_ID, "Gold"], ["0xMULTI", "0x00", "Minima"], ["0xPLAIN", "0xCC", "Silver"], ["0xUNNAMED", "0xDD", "0xDD"]
    ]);
  });

  it("returns a null counterparty when every coin on the other side is local", () => {
    const txpow = historyTxpow("0xCONSOLIDATE", 1, [historyCoin({ address: LOCAL_ADDRESS, amount: "3" })], []);
    const [entry] = parseHistoryResponse(historyBody([{ txpow, difference: { "0x00": "-3" } }]), local);
    assert.equal(entry.direction, "out");
    assert.equal(entry.counterparty, null);
  });

  it("skips malformed TxPoWs and differences instead of throwing", () => {
    const good = historyTxpow("0xGOOD", 5, [], []);
    const entries = parseHistoryResponse({ status: true, response: {
      txpows: [null, { ...good, txpowid: 1 }, { ...good, header: { timemilli: "soon" } }, good, good],
      details: [{ difference: { "0x00": "1" } }, { difference: { "0x00": "1" } }, { difference: { "0x00": "1" } },
        { difference: { "0x00": "1e5", "0x01": 2, "0x02": "-4" } }]
    } }, local);
    assert.deepEqual(entries.map((entry) => [entry.txpowId, entry.tokenId, entry.direction]), [["0xGOOD", "0x02", "out"]]);
  });

  it("parses a Pi-recorded testnet history: received, sent, and self-transfer", () => {
    const recorded = JSON.parse(readFileSync(new URL("../../fixtures/minima-testnet-history.json", import.meta.url), "utf8"));
    const entries = parseHistoryResponse(recorded.history, new Set(recorded.localTrackedAddresses));
    const peer = "MxG0817DWN95HF1G21QWAV0GPYPF15FCGBSQRSVWSDPD21M7VU7VY6DPQQD4673";

    assert.deepEqual(entries.map(({ direction, amount, counterparty, tokenName }) => ({ direction, amount, counterparty, tokenName })), [
      { direction: "self", amount: "0", counterparty: null, tokenName: "Minima" },
      { direction: "out", amount: "2.5", counterparty: peer, tokenName: "Minima" },
      { direction: "in", amount: "10", counterparty: peer, tokenName: "Minima" }
    ]);
    assert.equal(entries[2].timeMillis, 1791535329786);
    assert.equal(entries[1].transactionId, "0x67D843B5988652A30EF0709E70913C93D3BB43FF29D1A462B4865E932A836F0A");
  });

  it("throws when the history call itself failed", () => {
    for (const body of [null, { status: false, error: "x" }, { status: true, response: { txpows: [] } }]) {
      assert.throws(() => parseHistoryResponse(body, local), /successful history response/);
    }
  });
});

describe("parseImportResponse", () => {
  it("returns a failed result with the error message when status is false", () => {
    const result = parseImportResponse({ status: false, error: "bad phrase" });
    assert.equal(result.ok, false);
    assert.equal(result.message, "bad phrase");
  });

  it("returns a fixed success message on success", () => {
    const result = parseImportResponse({ status: true });
    assert.equal(result.ok, true);
    assert.match(result.message, /Wallet restored/);
  });
});
