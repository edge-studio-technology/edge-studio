import assert from "node:assert/strict";
import type { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

const mockEnv = { backendInternalUrl: "http://backend:3000" };
vi.mock("../../src/config/env.js", () => ({ env: mockEnv }));

const { requireAdmin } = await import("../../src/auth/auth.middleware.js");

function mockResponse() {
  const calls: { status?: number; json?: unknown } = {};
  const res = {
    status(code: number) {
      calls.status = code;
      return res;
    },
    json(body: unknown) {
      calls.json = body;
      return res;
    }
  } as unknown as Response;
  return { res, calls };
}

function mockNext() {
  let called = false;
  const next: NextFunction = () => {
    called = true;
  };
  return { next, wasCalled: () => called };
}

function mockRequest(cookie?: string): Request {
  return { headers: cookie ? { cookie } : {} } as unknown as Request;
}

describe("requireAdmin", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockEnv.backendInternalUrl = "http://backend:3000";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("rejects a request with no cookie header", async () => {
    const req = mockRequest();
    const { res, calls } = mockResponse();
    const { next, wasCalled } = mockNext();

    await requireAdmin(req, res, next);

    assert.equal(calls.status, 401);
    assert.deepEqual(calls.json, { error: "Unauthorized" });
    assert.equal(wasCalled(), false);
  });

  it("rejects when the backend auth check responds not-ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    const req = mockRequest("session=abc");
    const { res, calls } = mockResponse();
    const { next, wasCalled } = mockNext();

    await requireAdmin(req, res, next);

    assert.equal(calls.status, 401);
    assert.deepEqual(calls.json, { error: "Unauthorized" });
    assert.equal(wasCalled(), false);
  });

  it("rejects when the authenticated user is not an admin", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ role: "operator" }) });
    const req = mockRequest("session=abc");
    const { res, calls } = mockResponse();
    const { next, wasCalled } = mockNext();

    await requireAdmin(req, res, next);

    assert.equal(calls.status, 403);
    assert.deepEqual(calls.json, { error: "Forbidden" });
    assert.equal(wasCalled(), false);
  });

  it("calls next when the backend confirms an admin session", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ role: "admin" }) });
    global.fetch = fetchMock;
    const req = mockRequest("session=abc");
    const { res, calls } = mockResponse();
    const { next, wasCalled } = mockNext();

    await requireAdmin(req, res, next);

    assert.equal(calls.status, undefined);
    assert.equal(wasCalled(), true);
    assert.equal(fetchMock.mock.calls[0][0], "http://backend:3000/api/auth/me");
    assert.equal(fetchMock.mock.calls[0][1].headers.cookie, "session=abc");
  });

  it("responds 502 when the backend auth check fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));
    const req = mockRequest("session=abc");
    const { res, calls } = mockResponse();
    const { next, wasCalled } = mockNext();

    await requireAdmin(req, res, next);

    assert.equal(calls.status, 502);
    assert.deepEqual(calls.json, { error: "Auth check failed" });
    assert.equal(wasCalled(), false);
  });
});
