import { describe, expect, it } from "vitest";
import { normalizeError, titleFromType } from "../../src/lib/errors";

describe("titleFromType", () => {
  it("maps known types to friendly titles", () => {
    expect(titleFromType("command_unavailable", "fallback")).toBe("Command unavailable");
    expect(titleFromType("hardware_unavailable", "fallback")).toBe("Hardware unavailable");
    expect(titleFromType("invalid_payload", "fallback")).toBe("Invalid payload");
    expect(titleFromType("connection_failed", "fallback")).toBe("Connection failed");
    expect(titleFromType("validation_failed", "fallback")).toBe("Validation failed");
    expect(titleFromType("not_found", "fallback")).toBe("Not found");
    expect(titleFromType("forbidden", "fallback")).toBe("Permission denied");
    expect(titleFromType("conflict", "fallback")).toBe("Conflict");
    expect(titleFromType("dependency_unavailable", "fallback")).toBe("Dependency unavailable");
    expect(titleFromType("unexpected", "fallback")).toBe("Unexpected error");
  });

  it("uses the fallback for the unknown type", () => {
    expect(titleFromType("unknown", "My Fallback")).toBe("My Fallback");
  });

  it("title-cases unrecognized types", () => {
    expect(titleFromType("some_other_type", "fallback")).toBe("Some Other Type");
  });
});

describe("normalizeError", () => {
  it("normalizes a plain string", () => {
    expect(normalizeError("boom")).toEqual({
      domain: "unknown",
      type: "unknown",
      title: "Error",
      message: "boom",
      raw: "boom",
    });
  });

  it("uses the fallback title for a string with a custom fallback", () => {
    expect(normalizeError("boom", "Custom")).toMatchObject({ title: "Custom", message: "boom" });
  });

  it("falls back to a generic message for unrecognized values", () => {
    expect(normalizeError(null)).toMatchObject({
      domain: "unknown",
      type: "unknown",
      title: "Error",
      message: "Unknown error",
      raw: null,
    });
    expect(normalizeError(42)).toMatchObject({ message: "Unknown error", raw: 42 });
  });

  it("reads a structured error directly on the object", () => {
    const value = { domain: "integritas", type: "not_found", message: "Proof not found" };
    expect(normalizeError(value)).toMatchObject({
      domain: "integritas",
      type: "not_found",
      title: "Not found",
      message: "Proof not found",
      raw: value,
    });
  });

  it("reads a structured error nested under errorDetails", () => {
    const value = {
      errorDetails: {
        domain: "minima",
        type: "connection_failed",
        message: "RPC unreachable",
        nativeMessage: "ECONNREFUSED",
        nativeCode: "ECONNREFUSED",
        context: { host: "minima" },
        occurredAt: "2026-08-20T00:00:00.000Z",
      },
    };
    expect(normalizeError(value)).toEqual({
      domain: "minima",
      type: "connection_failed",
      title: "Connection failed",
      message: "RPC unreachable",
      nativeMessage: "ECONNREFUSED",
      nativeCode: "ECONNREFUSED",
      context: { host: "minima" },
      occurredAt: "2026-08-20T00:00:00.000Z",
      raw: value,
    });
  });

  it("drops a non-object context", () => {
    const value = { message: "oops", context: "not-an-object" };
    expect(normalizeError(value).context).toBeUndefined();
  });

  it("drops an array context", () => {
    const value = { message: "oops", context: [1, 2, 3] };
    expect(normalizeError(value).context).toBeUndefined();
  });

  it("falls back to unknown message shape for an object with no message", () => {
    const value = { foo: "bar" };
    expect(normalizeError(value)).toMatchObject({ message: "Unknown error", raw: value });
  });
});
