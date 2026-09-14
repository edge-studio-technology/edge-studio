import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { fetchJsonWithTimeout, parseResponseBody } from "../../src/shared/http.js";

describe("parseResponseBody", () => {
  it("returns null for an empty string", () => {
    assert.equal(parseResponseBody(""), null);
  });

  it("parses valid JSON", () => {
    assert.deepEqual(parseResponseBody('{"a":1}'), { a: 1 });
  });

  it("returns the raw text when it is not valid JSON", () => {
    assert.equal(parseResponseBody("not json"), "not json");
  });
});

describe("fetchJsonWithTimeout", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the response and parsed JSON body on success", async () => {
    const response = { ok: true, status: 200, text: async () => '{"ok":true}' };
    fetchMock.mockResolvedValue(response);

    const result = await fetchJsonWithTimeout("https://example.com/api");

    assert.equal(result.response, response);
    assert.deepEqual(result.body, { ok: true });
  });

  it("passes the url and options through to fetch, plus an abort signal", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "" });

    await fetchJsonWithTimeout("https://example.com/api", { method: "POST", headers: { "x-test": "1" } }, 1000);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    assert.equal(url, "https://example.com/api");
    assert.equal(options.method, "POST");
    assert.equal((options.headers as Record<string, string>)["x-test"], "1");
    assert.ok(options.signal instanceof AbortSignal);
  });

  it("returns a null body when the response text is empty", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, text: async () => "" });

    const result = await fetchJsonWithTimeout("https://example.com/api");
    assert.equal(result.body, null);
  });

  it("aborts the request signal once the timeout elapses", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, options: RequestInit) => {
      capturedSignal = options.signal as AbortSignal;
      return new Promise(() => {});
    });

    const pending = fetchJsonWithTimeout("https://example.com/api", {}, 50);
    pending.catch(() => {});
    await vi.advanceTimersByTimeAsync(50);

    assert.equal(capturedSignal?.aborted, true);
    vi.useRealTimers();
  });

  it("propagates a rejected fetch", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await assert.rejects(() => fetchJsonWithTimeout("https://example.com/api"), /network down/);
  });
});
