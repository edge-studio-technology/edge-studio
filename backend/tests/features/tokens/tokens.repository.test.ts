import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let tokensRepository: typeof import("../../../src/features/tokens/tokens.repository.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  tokensRepository = await import("../../../src/features/tokens/tokens.repository.js");
});

afterAll(() => {
  teardown();
});

describe("tokens.repository", () => {
  it("inserts a custom token and returns the stored record", () => {
    const record = tokensRepository.insertCustomToken({
      tokenId: "0xAAA",
      name: "TestToken",
      amount: "100",
      decimal: 2,
      txpowId: "0xTXP"
    });

    assert.equal(record.token_id, "0xAAA");
    assert.equal(record.name, "TestToken");
    assert.equal(record.amount, "100");
    assert.equal(record.decimal, 2);
    assert.equal(record.txpow_id, "0xTXP");
    assert.ok(record.id);
    assert.ok(record.created_at);
  });

  it("allows a null txpowId", () => {
    const record = tokensRepository.insertCustomToken({
      tokenId: "0xBBB",
      name: "NoTxpow",
      amount: "1",
      decimal: 0,
      txpowId: null
    });

    assert.equal(record.txpow_id, null);
  });

  it("getCustomTokenByTokenId returns null when not found", () => {
    const record = tokensRepository.getCustomTokenByTokenId("0xMISSING");
    assert.equal(record, null);
  });

  it("getCustomTokenByTokenId trims the lookup tokenId", () => {
    tokensRepository.insertCustomToken({
      tokenId: "0xCCC",
      name: "TrimTest",
      amount: "5",
      decimal: 4,
      txpowId: null
    });

    const record = tokensRepository.getCustomTokenByTokenId("  0xCCC  ");
    assert.ok(record);
    assert.equal(record?.token_id, "0xCCC");
  });

  it("listCustomTokens returns every inserted token", () => {
    tokensRepository.insertCustomToken({
      tokenId: "0xLIST1",
      name: "List1",
      amount: "1",
      decimal: 0,
      txpowId: null
    });
    tokensRepository.insertCustomToken({
      tokenId: "0xLIST2",
      name: "List2",
      amount: "1",
      decimal: 0,
      txpowId: null
    });

    const tokens = tokensRepository.listCustomTokens();
    const tokenIds = tokens.map((t) => t.token_id);
    assert.ok(tokenIds.includes("0xLIST1"));
    assert.ok(tokenIds.includes("0xLIST2"));
  });
});
