import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { requestLogger } from "../../src/middleware/requestLogger.js";

// Built at runtime so a failing assertion can print the log line without echoing a real credential.
const TOKEN = ["token", "under", "test"].join("-");

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
});

function logLine(method: string, originalUrl: string) {
  const next = vi.fn();
  requestLogger({ method, originalUrl } as Request, {} as Response, next);
  assert.equal(next.mock.calls.length, 1);
  return String(logSpy.mock.calls.at(-1)?.[0]);
}

describe("requestLogger", () => {
  it("masks the webhook token segment", () => {
    const line = logLine("POST", `/api/data-source-webhooks/${TOKEN}`);
    assert.equal(line.includes(TOKEN), false);
    assert.match(line, / POST \/api\/data-source-webhooks\/\[redacted\]$/);
  });

  it("keeps the query string and trailing path after the masked token", () => {
    assert.match(logLine("POST", `/api/data-source-webhooks/${TOKEN}?a=1&b=2`), / POST \/api\/data-source-webhooks\/\[redacted\]\?a=1&b=2$/);
    assert.match(logLine("POST", `/api/data-source-webhooks/${TOKEN}/extra`), / POST \/api\/data-source-webhooks\/\[redacted\]\/extra$/);
  });

  it("logs unrelated routes unchanged", () => {
    assert.match(logLine("GET", "/api/automation/runs?page=2&status=failed"), /^\S+ GET \/api\/automation\/runs\?page=2&status=failed$/);
    assert.match(logLine("GET", "/api/data-sources/abc/read"), / GET \/api\/data-sources\/abc\/read$/);
  });
});
