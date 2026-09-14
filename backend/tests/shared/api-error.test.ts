import assert from "node:assert/strict";
import type { Response } from "express";
import { describe, it } from "vitest";
import {
  apiErrorFromStatus,
  badRequest,
  conflict,
  dependencyUnavailable,
  forbidden,
  notFound,
  sendApiError,
  unauthorized,
  unexpected,
  validationFailed
} from "../../src/shared/api-error.js";
import { appError } from "../../src/shared/structured-error.js";

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

describe("sendApiError", () => {
  it("sets the status and merges extra fields alongside error/errorDetails", () => {
    const { res, calls } = mockResponse();
    const error = appError({ type: "bad_request", message: "oops" });

    sendApiError(res, 400, error, { path: "/a" });

    assert.equal(calls.status, 400);
    assert.deepEqual(calls.json, { path: "/a", error: "oops", errorDetails: error });
  });
});

describe("status-specific helpers", () => {
  it("badRequest sends 400 with a bad_request app error", () => {
    const { res, calls } = mockResponse();
    badRequest(res, "bad input", { field: "x" });
    assert.equal(calls.status, 400);
    const body = calls.json as { error: string; errorDetails: { domain: string; type: string; context?: unknown } };
    assert.equal(body.error, "bad input");
    assert.equal(body.errorDetails.domain, "app");
    assert.equal(body.errorDetails.type, "bad_request");
    assert.deepEqual(body.errorDetails.context, { field: "x" });
  });

  it("validationFailed sends 400 with fieldErrors in context", () => {
    const { res, calls } = mockResponse();
    validationFailed(res, "invalid", { name: "required" });
    assert.equal(calls.status, 400);
    const body = calls.json as { errorDetails: { type: string; context?: { fieldErrors?: unknown } } };
    assert.equal(body.errorDetails.type, "validation_failed");
    assert.deepEqual(body.errorDetails.context?.fieldErrors, { name: "required" });
  });

  it("unauthorized sends 401 with a default message", () => {
    const { res, calls } = mockResponse();
    unauthorized(res);
    assert.equal(calls.status, 401);
    assert.equal((calls.json as { error: string }).error, "Unauthorized");
  });

  it("forbidden sends 403 with a default message", () => {
    const { res, calls } = mockResponse();
    forbidden(res);
    assert.equal(calls.status, 403);
    assert.equal((calls.json as { error: string }).error, "Forbidden");
  });

  it("notFound sends 404", () => {
    const { res, calls } = mockResponse();
    notFound(res, "missing");
    assert.equal(calls.status, 404);
    assert.equal((calls.json as { errorDetails: { type: string } }).errorDetails.type, "not_found");
  });

  it("conflict sends 409 with context", () => {
    const { res, calls } = mockResponse();
    conflict(res, "already exists", { id: "1" });
    assert.equal(calls.status, 409);
    assert.deepEqual((calls.json as { errorDetails: { context?: unknown } }).errorDetails.context, { id: "1" });
  });

  it("dependencyUnavailable sends 502 as a system error with nativeMessage", () => {
    const { res, calls } = mockResponse();
    dependencyUnavailable(res, "minima down", "ECONNREFUSED");
    assert.equal(calls.status, 502);
    const body = calls.json as { errorDetails: { domain: string; nativeMessage?: string } };
    assert.equal(body.errorDetails.domain, "system");
    assert.equal(body.errorDetails.nativeMessage, "ECONNREFUSED");
  });

  it("unexpected sends 500 as a system error and extracts an Error's message", () => {
    const { res, calls } = mockResponse();
    unexpected(res, "failed", new Error("boom"));
    assert.equal(calls.status, 500);
    const body = calls.json as { errorDetails: { domain: string; type: string; nativeMessage?: string } };
    assert.equal(body.errorDetails.domain, "system");
    assert.equal(body.errorDetails.type, "unexpected");
    assert.equal(body.errorDetails.nativeMessage, "boom");
  });

  it("unexpected leaves nativeMessage undefined for a non-Error value", () => {
    const { res, calls } = mockResponse();
    unexpected(res, "failed", "not an error instance");
    const body = calls.json as { errorDetails: { nativeMessage?: string } };
    assert.equal(body.errorDetails.nativeMessage, undefined);
  });
});

describe("apiErrorFromStatus", () => {
  const cases: Array<[number, string]> = [
    [400, "bad_request"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"]
  ];

  for (const [status, type] of cases) {
    it(`maps ${status} to a ${type} app error`, () => {
      const { res, calls } = mockResponse();
      apiErrorFromStatus(res, status, "message");
      assert.equal(calls.status, status);
      assert.equal((calls.json as { errorDetails: { type: string } }).errorDetails.type, type);
    });
  }

  it("maps other 4xx statuses to a bad_request app error at that status code", () => {
    const { res, calls } = mockResponse();
    apiErrorFromStatus(res, 418, "teapot");
    assert.equal(calls.status, 418);
    const body = calls.json as { errorDetails: { domain: string; type: string } };
    assert.equal(body.errorDetails.domain, "app");
    assert.equal(body.errorDetails.type, "bad_request");
  });

  it("maps 5xx statuses to an unexpected system error at that status code", () => {
    const { res, calls } = mockResponse();
    apiErrorFromStatus(res, 503, "unavailable");
    assert.equal(calls.status, 503);
    const body = calls.json as { errorDetails: { domain: string; type: string } };
    assert.equal(body.errorDetails.domain, "system");
    assert.equal(body.errorDetails.type, "unexpected");
  });
});
