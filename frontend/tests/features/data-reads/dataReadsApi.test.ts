import { describe, expect, it, vi } from "vitest";

const getJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
}));

import { getDataSourceRead, listDataReads } from "../../../src/features/data-reads/dataReadsApi";

describe("dataReadsApi", () => {
  it("listDataReads GETs the default page when called with no params", async () => {
    const page = { items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 };
    getJson.mockResolvedValue(page);

    const result = await listDataReads();

    expect(getJson).toHaveBeenCalledWith("/api/data-reads?pageSize=50");
    expect(result).toBe(page);
  });

  it("listDataReads builds the query string from given params", async () => {
    const page = { items: [], page: 2, pageSize: 10, total: 0, totalPages: 0 };
    getJson.mockResolvedValue(page);

    const result = await listDataReads({ page: 2, pageSize: 10, status: "failed", q: "foo" });

    expect(getJson).toHaveBeenCalledWith(
      "/api/data-reads?page=2&pageSize=10&status=failed&q=foo",
    );
    expect(result).toBe(page);
  });

  it("getDataSourceRead GETs the read by id", async () => {
    const item = { item: { id: "r1" } };
    getJson.mockResolvedValue(item);

    const result = await getDataSourceRead("r1");

    expect(getJson).toHaveBeenCalledWith("/api/data-reads/r1");
    expect(result).toBe(item);
  });
});
