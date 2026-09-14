import { describe, expect, it } from "vitest";
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  ADMIN_PIN_LENGTH,
  adminPinHint,
  getAdminPasswordRequirements,
  isValidAdminCredential,
  isValidAdminPassword,
  isValidAdminPin,
  sanitizePinInput,
} from "../../../src/features/auth/adminCredentials";

describe("isValidAdminPin", () => {
  it("accepts a 6-digit pin", () => {
    expect(isValidAdminPin("123456")).toBe(true);
  });

  it("rejects a pin that is too short", () => {
    expect(isValidAdminPin("12345")).toBe(false);
  });

  it("rejects a pin that is too long", () => {
    expect(isValidAdminPin("1234567")).toBe(false);
  });

  it("rejects a pin with non-digit characters", () => {
    expect(isValidAdminPin("12a456")).toBe(false);
  });
});

describe("getAdminPasswordRequirements", () => {
  it("marks all requirements unmet for an empty password", () => {
    const requirements = getAdminPasswordRequirements("");
    expect(requirements.every((requirement) => !requirement.met)).toBe(true);
    expect(requirements.map((requirement) => requirement.id)).toEqual([
      "length",
      "uppercase",
      "lowercase",
      "number",
      "symbol",
    ]);
  });

  it("marks all requirements met for a fully compliant password", () => {
    const requirements = getAdminPasswordRequirements("Abcdef1!");
    expect(requirements.every((requirement) => requirement.met)).toBe(true);
  });

  it("evaluates each requirement independently", () => {
    const requirements = getAdminPasswordRequirements("abcdefgh");
    const byId = Object.fromEntries(requirements.map((r) => [r.id, r.met]));
    expect(byId.length).toBe(true);
    expect(byId.lowercase).toBe(true);
    expect(byId.uppercase).toBe(false);
    expect(byId.number).toBe(false);
    expect(byId.symbol).toBe(false);
  });

  it("includes the configured minimum length in the length label", () => {
    const requirements = getAdminPasswordRequirements("");
    const length = requirements.find((r) => r.id === "length");
    expect(length?.label).toBe(`${ADMIN_PASSWORD_MIN_LENGTH} + characters`);
  });
});

describe("isValidAdminPassword", () => {
  it("returns true only when every requirement is met", () => {
    expect(isValidAdminPassword("Abcdef1!")).toBe(true);
    expect(isValidAdminPassword("abcdef1!")).toBe(false);
  });
});

describe("isValidAdminCredential", () => {
  it("validates a pin when type is pin", () => {
    expect(isValidAdminCredential("pin", "123456")).toBe(true);
    expect(isValidAdminCredential("pin", "abcdef")).toBe(false);
  });

  it("validates a password when type is password", () => {
    expect(isValidAdminCredential("password", "Abcdef1!")).toBe(true);
    expect(isValidAdminCredential("password", "weak")).toBe(false);
  });
});

describe("sanitizePinInput", () => {
  it("strips non-digit characters", () => {
    expect(sanitizePinInput("1a2b3c")).toBe("123");
  });

  it("truncates to the configured pin length", () => {
    expect(sanitizePinInput("1234567890")).toBe("1234567890".slice(0, ADMIN_PIN_LENGTH));
  });
});

describe("adminPinHint", () => {
  it("describes the configured pin length", () => {
    expect(adminPinHint()).toBe(`${ADMIN_PIN_LENGTH}-digit PIN`);
  });
});
