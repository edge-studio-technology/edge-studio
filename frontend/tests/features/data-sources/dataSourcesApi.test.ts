import { afterEach, describe, expect, it, vi } from "vitest";

const getJson = vi.fn();
const postJson = vi.fn();
const patchJson = vi.fn();
const deleteJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
  postJson: (...args: unknown[]) => postJson(...args),
  patchJson: (...args: unknown[]) => patchJson(...args),
  deleteJson: (...args: unknown[]) => deleteJson(...args),
}));

import {
  checkDataSourceHealth,
  createDataSource,
  deleteDataSource,
  getDataSourceCapabilities,
  listDataSources,
  readDataSource,
  testDataSourceOutput,
  updateDataSource,
} from "../../../src/features/data-sources/dataSourcesApi";

describe("dataSourcesApi", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("listDataSources GETs the collection", async () => {
    const result = { items: [] };
    getJson.mockResolvedValue(result);
    expect(await listDataSources()).toBe(result);
    expect(getJson).toHaveBeenCalledWith("/api/data-sources");
  });

  it("getDataSourceCapabilities GETs capabilities", async () => {
    const result = { gpioInput: { available: true, devicePath: "", reason: null } };
    getJson.mockResolvedValue(result);
    expect(await getDataSourceCapabilities()).toBe(result);
    expect(getJson).toHaveBeenCalledWith("/api/data-sources/capabilities");
  });

  it("createDataSource POSTs the input", async () => {
    const input = { name: "n", type: "json-api" as const, description: "d", config: {} };
    const result = { item: {} };
    postJson.mockResolvedValue(result);
    expect(await createDataSource(input)).toBe(result);
    expect(postJson).toHaveBeenCalledWith("/api/data-sources", input);
  });

  it("updateDataSource PATCHes by id", async () => {
    const input = { name: "n", type: "json-api" as const, description: "d", config: {} };
    const result = { item: {} };
    patchJson.mockResolvedValue(result);
    expect(await updateDataSource("id-1", input)).toBe(result);
    expect(patchJson).toHaveBeenCalledWith("/api/data-sources/id-1", input);
  });

  it("deleteDataSource DELETEs by id", async () => {
    deleteJson.mockResolvedValue(undefined);
    await deleteDataSource("id-1");
    expect(deleteJson).toHaveBeenCalledWith("/api/data-sources/id-1");
  });

  it("readDataSource POSTs a manual read trigger by id", async () => {
    const result = { item: {}, result: { ok: true } };
    postJson.mockResolvedValue(result);
    expect(await readDataSource("id-1")).toBe(result);
    expect(postJson).toHaveBeenCalledWith("/api/data-sources/id-1/read");
  });

  it("testDataSourceOutput POSTs with a default duration", async () => {
    const result = { item: {}, result: { ok: true } };
    postJson.mockResolvedValue(result);
    expect(await testDataSourceOutput("id-1")).toBe(result);
    expect(postJson).toHaveBeenCalledWith("/api/data-sources/id-1/test-output", { durationMs: 500 });
  });

  it("testDataSourceOutput POSTs a custom duration", async () => {
    postJson.mockResolvedValue({});
    await testDataSourceOutput("id-1", 2000);
    expect(postJson).toHaveBeenCalledWith("/api/data-sources/id-1/test-output", { durationMs: 2000 });
  });

  it("checkDataSourceHealth fetches the health endpoint with credentials and parses JSON", async () => {
    const status = { ok: true, checkedAt: "2026-08-20T00:00:00.000Z" };
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve(status) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkDataSourceHealth("id-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/data-sources/id-1/health", { credentials: "include" });
    expect(result).toBe(status);
  });
});
