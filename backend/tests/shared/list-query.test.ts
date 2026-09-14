import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { parseListQuery, toPaginatedResult } from "../../src/shared/list-query.js";

describe("parseListQuery", () => {
  it("applies defaults when nothing is provided", () => {
    const result = parseListQuery({});
    assert.deepEqual(result, { ok: true, value: { page: 1, pageSize: 50 } });
  });

  it("uses a custom defaultPageSize", () => {
    const result = parseListQuery({}, { defaultPageSize: 20 });
    assert.equal(result.ok, true);
    assert.equal((result as { ok: true; value: { pageSize: number } }).value.pageSize, 20);
  });

  it("parses a valid page and pageSize", () => {
    const result = parseListQuery({ page: "3", pageSize: "25" });
    assert.equal(result.ok, true);
    assert.deepEqual((result as { ok: true; value: unknown }).value, { page: 3, pageSize: 25 });
  });

  it("falls back to page 1 for a non-numeric or sub-1 page", () => {
    assert.equal((parseListQuery({ page: "abc" }) as { value: { page: number } }).value.page, 1);
    assert.equal((parseListQuery({ page: "0" }) as { value: { page: number } }).value.page, 1);
    assert.equal((parseListQuery({ page: "-5" }) as { value: { page: number } }).value.page, 1);
  });

  it("truncates a fractional page", () => {
    assert.equal((parseListQuery({ page: "2.9" }) as { value: { page: number } }).value.page, 2);
  });

  it("clamps pageSize to the configured minimum", () => {
    const result = parseListQuery({ pageSize: "1" }, { minPageSize: 10, maxPageSize: 100 });
    assert.equal((result as { value: { pageSize: number } }).value.pageSize, 10);
  });

  it("clamps pageSize to the configured maximum", () => {
    const result = parseListQuery({ pageSize: "9999" }, { minPageSize: 10, maxPageSize: 100 });
    assert.equal((result as { value: { pageSize: number } }).value.pageSize, 100);
  });

  it("falls back to the default pageSize for a non-numeric or non-positive value", () => {
    assert.equal((parseListQuery({ pageSize: "abc" }, { defaultPageSize: 40 }) as { value: { pageSize: number } }).value.pageSize, 40);
    assert.equal((parseListQuery({ pageSize: "0" }, { defaultPageSize: 40 }) as { value: { pageSize: number } }).value.pageSize, 40);
  });

  it("omits status/q from the result when not provided", () => {
    const result = parseListQuery({}) as { value: Record<string, unknown> };
    assert.equal("status" in result.value, false);
    assert.equal("q" in result.value, false);
  });

  it("includes a trimmed status when provided and allowed", () => {
    const result = parseListQuery({ status: "  pending  " }, { allowedStatuses: ["pending", "done"] });
    assert.equal(result.ok, true);
    assert.equal((result as { value: { status?: string } }).value.status, "pending");
  });

  it("rejects a status not in allowedStatuses", () => {
    const result = parseListQuery({ status: "bogus" }, { allowedStatuses: ["pending", "done"] });
    assert.equal(result.ok, false);
    assert.match((result as { error: string }).error, /status must be one of/);
  });

  it("allows any status when allowedStatuses is not configured", () => {
    const result = parseListQuery({ status: "anything" });
    assert.equal(result.ok, true);
    assert.equal((result as { value: { status?: string } }).value.status, "anything");
  });

  it("includes a trimmed q when provided", () => {
    const result = parseListQuery({ q: "  search term  " });
    assert.equal((result as { value: { q?: string } }).value.q, "search term");
  });

  it("rejects a q longer than 200 characters", () => {
    const result = parseListQuery({ q: "x".repeat(201) });
    assert.equal(result.ok, false);
    assert.match((result as { error: string }).error, /200 characters or fewer/);
  });
});

describe("toPaginatedResult", () => {
  it("computes totalPages by ceiling division", () => {
    const result = toPaginatedResult(["a", "b"], 25, { page: 1, pageSize: 10 });
    assert.deepEqual(result, { items: ["a", "b"], page: 1, pageSize: 10, total: 25, totalPages: 3 });
  });

  it("returns totalPages 0 when total is 0", () => {
    const result = toPaginatedResult([], 0, { page: 1, pageSize: 10 });
    assert.equal(result.totalPages, 0);
  });

  it("returns exact totalPages when total divides evenly", () => {
    const result = toPaginatedResult([], 20, { page: 1, pageSize: 10 });
    assert.equal(result.totalPages, 2);
  });
});
