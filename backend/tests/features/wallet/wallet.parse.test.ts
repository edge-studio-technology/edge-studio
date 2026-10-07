import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  parseAddressResponse,
  parseBalanceResponse,
  parseImportResponse,
  parseLocalWalletAddressesResponse,
  parsePaymentStatusResponse,
  parseSendResponse
} from "../../../src/features/wallet/wallet.parse.js";

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
  });
});

describe("parsePaymentStatusResponse", () => {
  it("returns unknown when the body is not a record", () => {
    const result = parsePaymentStatusResponse(null, "tx-1");
    assert.equal(result.status, "unknown");
    assert.equal(result.txpowId, "tx-1");
  });

  it("returns unknown when status is false", () => {
    const result = parsePaymentStatusResponse({ status: false }, "tx-1");
    assert.equal(result.status, "unknown");
  });

  it("returns unknown when response is missing", () => {
    const result = parsePaymentStatusResponse({ status: true }, "tx-1");
    assert.equal(result.status, "unknown");
  });

  it("returns unknown when txpow is missing from the response", () => {
    const result = parsePaymentStatusResponse({ response: {} }, "tx-1");
    assert.equal(result.status, "unknown");
  });

  it("returns confirmed when response.confirmed is true", () => {
    const result = parsePaymentStatusResponse({ response: { confirmed: true, txpow: {} } }, "tx-1");
    assert.equal(result.status, "confirmed");
  });

  it("returns confirmed when txpow.isblock is true", () => {
    const result = parsePaymentStatusResponse({ response: { txpow: { isblock: true } } }, "tx-1");
    assert.equal(result.status, "confirmed");
  });

  it("returns pending when neither confirmation flag is set", () => {
    const result = parsePaymentStatusResponse({ response: { txpow: {} } }, "tx-1");
    assert.equal(result.status, "pending");
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
