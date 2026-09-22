import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE } from "../../src/lib/paginated";
import {
  defaultDiagnosticsListQuery,
  diagnosticsSearchParams,
  isValidDiagnosticsTab,
  parseDiagnosticsListQuery,
  parseDiagnosticsTab
} from "../../src/pages/diagnosticsQuery";

function params(query: string) {
  return new URLSearchParams(query);
}

describe("isValidDiagnosticsTab", () => {
  it("accepts the three known tabs", () => {
    expect(isValidDiagnosticsTab("proofs")).toBe(true);
    expect(isValidDiagnosticsTab("reads")).toBe(true);
    expect(isValidDiagnosticsTab("workflow-runs")).toBe(true);
  });

  it("rejects unknown values and null", () => {
    expect(isValidDiagnosticsTab("runs")).toBe(false);
    expect(isValidDiagnosticsTab("")).toBe(false);
    expect(isValidDiagnosticsTab(null)).toBe(false);
  });
});

describe("parseDiagnosticsTab", () => {
  it("returns the requested tab", () => {
    expect(parseDiagnosticsTab(params("tab=reads"))).toBe("reads");
    expect(parseDiagnosticsTab(params("tab=workflow-runs"))).toBe("workflow-runs");
    expect(parseDiagnosticsTab(params("tab=proofs"))).toBe("proofs");
  });

  it("falls back to proofs for a missing or unknown tab", () => {
    expect(parseDiagnosticsTab(params(""))).toBe("proofs");
    expect(parseDiagnosticsTab(params("tab=nope"))).toBe("proofs");
  });
});

describe("parseDiagnosticsListQuery", () => {
  it("returns defaults for an empty query string", () => {
    expect(parseDiagnosticsListQuery(params(""), "proofs")).toEqual(defaultDiagnosticsListQuery());
  });

  it("keeps a valid page and page size", () => {
    const result = parseDiagnosticsListQuery(params("page=3&pageSize=50"), "proofs");
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  it("falls back to page 1 for zero, negative and non-numeric pages", () => {
    expect(parseDiagnosticsListQuery(params("page=0"), "proofs").page).toBe(1);
    expect(parseDiagnosticsListQuery(params("page=-5"), "proofs").page).toBe(1);
    expect(parseDiagnosticsListQuery(params("page=abc"), "proofs").page).toBe(1);
  });

  it("truncates a fractional page", () => {
    expect(parseDiagnosticsListQuery(params("page=2.9"), "proofs").page).toBe(2);
  });

  it("clamps page size into the 10-100 range and falls back when unusable", () => {
    expect(parseDiagnosticsListQuery(params("pageSize=5"), "proofs").pageSize).toBe(10);
    expect(parseDiagnosticsListQuery(params("pageSize=1000"), "proofs").pageSize).toBe(100);
    expect(parseDiagnosticsListQuery(params("pageSize=0"), "proofs").pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parseDiagnosticsListQuery(params("pageSize=abc"), "proofs").pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("keeps a status only when the active tab allows it", () => {
    expect(parseDiagnosticsListQuery(params("status=ready"), "proofs").status).toBe("ready");
    expect(parseDiagnosticsListQuery(params("status=ready"), "reads").status).toBe("");
    expect(parseDiagnosticsListQuery(params("status=running"), "workflow-runs").status).toBe("running");
    expect(parseDiagnosticsListQuery(params("status=running"), "proofs").status).toBe("");
    expect(parseDiagnosticsListQuery(params("status=success"), "reads").status).toBe("success");
  });

  it("drops an unknown status on every tab", () => {
    expect(parseDiagnosticsListQuery(params("status=bogus"), "proofs").status).toBe("");
    expect(parseDiagnosticsListQuery(params("status=bogus"), "reads").status).toBe("");
    expect(parseDiagnosticsListQuery(params("status=bogus"), "workflow-runs").status).toBe("");
  });

  it("trims the search term and truncates it to 200 characters", () => {
    expect(parseDiagnosticsListQuery(params("q=%20%20hash%20%20"), "proofs").q).toBe("hash");
    expect(parseDiagnosticsListQuery(params(`q=${"a".repeat(250)}`), "proofs").q).toHaveLength(200);
  });
});

describe("diagnosticsSearchParams", () => {
  it("always writes tab, page and page size", () => {
    const result = diagnosticsSearchParams({ tab: "reads", query: defaultDiagnosticsListQuery() });
    expect(result.get("tab")).toBe("reads");
    expect(result.get("page")).toBe("1");
    expect(result.get("pageSize")).toBe(String(DEFAULT_PAGE_SIZE));
  });

  it("omits an empty status and search term", () => {
    const result = diagnosticsSearchParams({ tab: "proofs", query: defaultDiagnosticsListQuery() });
    expect(result.has("status")).toBe(false);
    expect(result.has("q")).toBe(false);
  });

  it("round-trips a populated query back to the same values", () => {
    const query = { page: 4, pageSize: 50, status: "failed", q: "abc123" };
    const written = diagnosticsSearchParams({ tab: "workflow-runs", query });

    expect(parseDiagnosticsTab(written)).toBe("workflow-runs");
    expect(parseDiagnosticsListQuery(written, "workflow-runs")).toEqual(query);
  });
});
