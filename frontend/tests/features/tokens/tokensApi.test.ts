import { describe, expect, it, vi } from "vitest";

const getJson = vi.fn();
const postJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
  postJson: (...args: unknown[]) => postJson(...args),
}));

import { createToken, getTokenCreateRequirements, listTokens } from "../../../src/features/tokens/tokensApi";

describe("tokensApi", () => {
  it("listTokens GETs the tokens endpoint", async () => {
    const response = { checkedAt: "2026-01-01T00:00:00Z", tokens: [] };
    getJson.mockResolvedValue(response);

    const result = await listTokens();

    expect(getJson).toHaveBeenCalledWith("/api/tokens");
    expect(result).toBe(response);
  });

  it("getTokenCreateRequirements GETs the create-requirements endpoint", async () => {
    const response = { estimatedMinimaCost: "0.01", minimumAccountMinima: "1", note: "Some note" };
    getJson.mockResolvedValue(response);

    const result = await getTokenCreateRequirements();

    expect(getJson).toHaveBeenCalledWith("/api/tokens/create-requirements");
    expect(result).toBe(response);
  });

  it("createToken POSTs the token request body", async () => {
    const response = {
      ok: true,
      tokenId: "0x123",
      name: "My Token",
      amount: "100",
      decimal: 2,
      txpowId: "0xabc",
    };
    postJson.mockResolvedValue(response);

    const body = { name: "My Token", amount: "100", decimal: 2 };
    const result = await createToken(body);

    expect(postJson).toHaveBeenCalledWith("/api/tokens/create", body);
    expect(result).toBe(response);
  });
});
