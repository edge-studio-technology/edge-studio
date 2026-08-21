import { afterEach, describe, expect, it, vi } from "vitest";

const getJson = vi.fn();
const postJson = vi.fn();
const postForm = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
  postJson: (...args: unknown[]) => postJson(...args),
  postForm: (...args: unknown[]) => postForm(...args),
}));

import {
  deleteSelected,
  downloadProofZip,
  downloadSelected,
  getHistory,
  getHistoryRecord,
  stampFile,
  verifyProofFile,
  verifyRecord,
} from "../../../src/features/integritas/integritasApi";

describe("integritasApi", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("getHistory GETs the history endpoint with default paging when no params given", async () => {
    const page = { items: [] };
    getJson.mockResolvedValue(page);

    const result = await getHistory();

    expect(getJson).toHaveBeenCalledWith("/api/integritas/history?pageSize=50");
    expect(result).toBe(page);
  });

  it("getHistory GETs the history endpoint with custom params", async () => {
    getJson.mockResolvedValue({ items: [] });

    await getHistory({ page: 2, pageSize: 10, status: "pending", q: "abc" });

    expect(getJson).toHaveBeenCalledWith(
      "/api/integritas/history?page=2&pageSize=10&status=pending&q=abc",
    );
  });

  it("getHistoryRecord GETs a single record by id", async () => {
    const response = { record: { id: "r1" } };
    getJson.mockResolvedValue(response);

    const result = await getHistoryRecord("r1");

    expect(getJson).toHaveBeenCalledWith("/api/integritas/history/r1");
    expect(result).toBe(response);
  });

  it("stampFile POSTs the file as form data", async () => {
    const response = { record: { id: "r1" } };
    postForm.mockResolvedValue(response);
    const file = new File(["data"], "data.txt");

    const result = await stampFile(file);

    expect(postForm).toHaveBeenCalledWith(
      "/api/integritas/stamp-file",
      expect.any(FormData),
    );
    const form = postForm.mock.calls[0][1] as FormData;
    expect(form.get("file")).toBe(file);
    expect(result).toBe(response);
  });

  it("verifyRecord POSTs to the verify endpoint for the given id", async () => {
    const response = { record: { id: "r1" }, response: {} };
    postJson.mockResolvedValue(response);

    const result = await verifyRecord("r1");

    expect(postJson).toHaveBeenCalledWith("/api/integritas/history/r1/verify");
    expect(result).toBe(response);
  });

  it("verifyProofFile POSTs the file as form data", async () => {
    const response = { response: {} };
    postForm.mockResolvedValue(response);
    const file = new File(["{}"], "proof.json");

    const result = await verifyProofFile(file);

    expect(postForm).toHaveBeenCalledWith(
      "/api/integritas/verify-proof-file",
      expect.any(FormData),
    );
    const form = postForm.mock.calls[0][1] as FormData;
    expect(form.get("file")).toBe(file);
    expect(result).toBe(response);
  });

  it("deleteSelected POSTs the ids to the delete-selected endpoint", async () => {
    postJson.mockResolvedValue({});

    await deleteSelected(["a", "b"]);

    expect(postJson).toHaveBeenCalledWith("/api/integritas/history/delete-selected", {
      ids: ["a", "b"],
    });
  });

  it("downloadSelected posts the ids, downloads the blob, and revokes the object URL", async () => {
    const blob = new Blob(["proofs"]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
      blob: () => Promise.resolve(blob),
    });
    vi.stubGlobal("fetch", fetchMock);
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await downloadSelected(["a", "b"]);

    expect(fetchMock).toHaveBeenCalledWith("/api/integritas/history/export-selected", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["a", "b"] }),
    });
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("downloadSelected throws the parsed error message on a failed response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Export failed" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadSelected(["a"])).rejects.toThrow("Export failed");
  });

  it("downloadSelected falls back to an HTTP status message when the response has no error field", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadSelected(["a"])).rejects.toThrow("HTTP 503");
  });

  it("downloadProofZip fetches, downloads the zip blob, and revokes the object URL", async () => {
    const blob = new Blob(["zip"]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
      blob: () => Promise.resolve(blob),
    });
    vi.stubGlobal("fetch", fetchMock);
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await downloadProofZip("r1");

    expect(fetchMock).toHaveBeenCalledWith("/api/integritas/history/r1/download-zip", {
      credentials: "include",
    });
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("downloadProofZip throws the parsed error message on a failed response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "Not found" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadProofZip("r1")).rejects.toThrow("Not found");
  });

  it("downloadProofZip falls back to an HTTP status message when json parsing fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("bad json")),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadProofZip("r1")).rejects.toThrow("HTTP 500");
  });
});
