import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  appError,
  blockError,
  dataSourceError,
  errorFromUnknown,
  errorMessage,
  parseStoredError,
  serializeStructuredError,
  structuredError,
  systemError,
  workflowError
} from "../../src/shared/structured-error.js";

describe("structuredError", () => {
  it("defaults occurredAt to the current time", () => {
    const before = new Date().toISOString();
    const error = structuredError({ domain: "app", type: "bad_request", message: "oops" });
    assert.ok(error.occurredAt && error.occurredAt >= before);
  });

  it("keeps an explicitly provided occurredAt", () => {
    const error = structuredError({ domain: "app", type: "bad_request", message: "oops", occurredAt: "2020-01-01T00:00:00.000Z" });
    assert.equal(error.occurredAt, "2020-01-01T00:00:00.000Z");
  });
});

describe("domain-tagged error builders", () => {
  it("dataSourceError sets domain data_source", () => {
    assert.equal(dataSourceError({ type: "fetch_failed", message: "x" }).domain, "data_source");
  });

  it("workflowError sets domain workflow", () => {
    assert.equal(workflowError({ type: "run_failed", message: "x" }).domain, "workflow");
  });

  it("blockError sets domain block", () => {
    assert.equal(blockError({ type: "block_failed", message: "x" }).domain, "block");
  });

  it("appError sets domain app", () => {
    assert.equal(appError({ type: "bad_request", message: "x" }).domain, "app");
  });

  it("systemError sets domain system", () => {
    assert.equal(systemError({ type: "unexpected", message: "x" }).domain, "system");
  });
});

describe("serializeStructuredError", () => {
  it("returns null for null/undefined", () => {
    assert.equal(serializeStructuredError(null), null);
    assert.equal(serializeStructuredError(undefined), null);
  });

  it("passes a plain string through unchanged", () => {
    assert.equal(serializeStructuredError("legacy error"), "legacy error");
  });

  it("JSON-serializes a structured error object", () => {
    const error = structuredError({ domain: "app", type: "bad_request", message: "oops", occurredAt: "2020-01-01T00:00:00.000Z" });
    assert.equal(serializeStructuredError(error), JSON.stringify(error));
  });
});

describe("parseStoredError", () => {
  it("returns null for null/undefined/empty input", () => {
    assert.equal(parseStoredError(null), null);
    assert.equal(parseStoredError(undefined), null);
    assert.equal(parseStoredError(""), null);
  });

  it("round-trips a serialized structured error", () => {
    const original = structuredError({ domain: "app", type: "bad_request", message: "oops", nativeMessage: "native", nativeCode: "E1", context: { a: 1 }, occurredAt: "2020-01-01T00:00:00.000Z" });
    const parsed = parseStoredError(serializeStructuredError(original));
    assert.deepEqual(parsed, original);
  });

  it("wraps a legacy plain-string error as domain/type unknown", () => {
    const parsed = parseStoredError("something broke");
    assert.deepEqual(parsed, { domain: "unknown", type: "unknown", message: "something broke" });
  });

  it("falls back to domain unknown for an unrecognized domain value", () => {
    const parsed = parseStoredError(JSON.stringify({ domain: "bogus", type: "x", message: "oops" }));
    assert.equal(parsed?.domain, "unknown");
  });

  it("falls back to type unknown when type is missing", () => {
    const parsed = parseStoredError(JSON.stringify({ domain: "app", message: "oops" }));
    assert.equal(parsed?.type, "unknown");
  });

  it("drops context when it is an array rather than an object", () => {
    const parsed = parseStoredError(JSON.stringify({ domain: "app", type: "x", message: "oops", context: [1, 2] }));
    assert.equal(parsed?.context, undefined);
  });

  it("treats malformed JSON without a message field as a legacy string error", () => {
    const parsed = parseStoredError(JSON.stringify({ domain: "app", type: "x" }));
    assert.deepEqual(parsed, { domain: "unknown", type: "unknown", message: JSON.stringify({ domain: "app", type: "x" }) });
  });
});

describe("errorMessage", () => {
  it("returns null for null/undefined", () => {
    assert.equal(errorMessage(null), null);
    assert.equal(errorMessage(undefined), null);
  });

  it("extracts the message from a structured error object", () => {
    assert.equal(errorMessage(appError({ type: "x", message: "structured message" })), "structured message");
  });

  it("extracts the message from a serialized structured error string", () => {
    const serialized = serializeStructuredError(appError({ type: "x", message: "serialized message" }));
    assert.equal(errorMessage(serialized), "serialized message");
  });

  it("returns a legacy plain string as-is", () => {
    assert.equal(errorMessage("legacy message"), "legacy message");
  });
});

describe("errorFromUnknown", () => {
  it("extracts message and leaves nativeCode undefined for a plain Error", () => {
    const result = errorFromUnknown(new Error("boom"), "fallback message");
    assert.equal(result.message, "boom");
    assert.equal(result.nativeMessage, "boom");
    assert.equal(result.nativeCode, undefined);
  });

  it("extracts a string code from an error-like object", () => {
    const err = Object.assign(new Error("boom"), { code: "ENOENT" });
    const result = errorFromUnknown(err, "fallback message");
    assert.equal(result.nativeCode, "ENOENT");
  });

  it("falls back to the fallback message for a non-Error value", () => {
    const result = errorFromUnknown("just a string", "fallback message");
    assert.equal(result.message, "fallback message");
    assert.equal(result.nativeMessage, undefined);
  });

  it("passes context through unchanged", () => {
    const result = errorFromUnknown(new Error("boom"), "fallback", { path: "/a" });
    assert.deepEqual(result.context, { path: "/a" });
  });
});
