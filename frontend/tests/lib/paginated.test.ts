import { describe, expect, it } from "vitest";
import { buildListQueryString, emptyPaginatedPage, listRangeLabel } from "../../src/lib/paginated";

describe("emptyPaginatedPage", () => {
  it("returns an empty page with the default page size", () => {
    expect(emptyPaginatedPage()).toEqual({ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 });
  });

  it("uses a custom page size when given", () => {
    expect(emptyPaginatedPage(10)).toEqual({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
  });
});

describe("buildListQueryString", () => {
  it("returns an empty string for no params", () => {
    expect(buildListQueryString()).toBe("");
    expect(buildListQueryString({})).toBe("");
  });

  it("omits page when page is 1 or less", () => {
    expect(buildListQueryString({ page: 1 })).toBe("");
  });

  it("includes page when greater than 1", () => {
    expect(buildListQueryString({ page: 2 })).toBe("?page=2");
  });

  it("includes pageSize, status, and q", () => {
    expect(buildListQueryString({ pageSize: 50, status: "active", q: "hello" })).toBe(
      "?pageSize=50&status=active&q=hello"
    );
  });

  it("combines multiple params", () => {
    expect(buildListQueryString({ page: 3, pageSize: 10 })).toBe("?page=3&pageSize=10");
  });
});

describe("listRangeLabel", () => {
  it("returns a zero label when total is 0", () => {
    expect(listRangeLabel(1, 25, 0)).toBe("Showing 0 of 0");
  });

  it("computes the range for the first page", () => {
    expect(listRangeLabel(1, 25, 60)).toBe("Showing 1–25 of 60");
  });

  it("clips the end to the total on the last page", () => {
    expect(listRangeLabel(3, 25, 60)).toBe("Showing 51–60 of 60");
  });
});
