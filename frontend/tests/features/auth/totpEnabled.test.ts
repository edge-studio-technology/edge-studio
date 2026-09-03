import { describe, expect, it } from "vitest";
import { TOTP_ENABLED } from "../../../src/features/auth/totpEnabled";

describe("TOTP_ENABLED", () => {
  it("is currently disabled (password-only auth)", () => {
    expect(TOTP_ENABLED).toBe(false);
  });
});
