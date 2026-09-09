import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { fetchExternalJson, fetchJsonWithTimeout, parseResponseBody } from "../../src/shared/http.js";
import { EgressUrlError } from "../../src/shared/url-policy.js";

const { fetchMock, lookupMock, agentOptions } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  lookupMock: vi.fn(),
  agentOptions: [] as { connect?: { lookup?: unknown } }[]
}));

vi.mock("undici", () => ({
  fetch: fetchMock,
  Agent: class {
    constructor(options: { connect?: { lookup?: unknown } }) {
      agentOptions.push(options);
    }
    close() {
      return Promise.resolve();
    }
  }
}));

vi.mock("node:dns/promises", () => ({ default: { lookup: lookupMock } }));


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
  const globalFetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", globalFetchMock);
    globalFetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the response and parsed JSON body on success", async () => {
    const response = { ok: true, status: 200, text: async () => '{"ok":true}' };
    globalFetchMock.mockResolvedValue(response);

    const result = await fetchJsonWithTimeout("https://example.com/api");

    assert.equal(result.response, response);
    assert.deepEqual(result.body, { ok: true });
  });

  it("passes the url and options through to fetch, plus an abort signal", async () => {
    globalFetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "" });

    await fetchJsonWithTimeout("https://example.com/api", { method: "POST", headers: { "x-test": "1" } }, 1000);

    const [url, options] = globalFetchMock.mock.calls[0] as [string, RequestInit];
    assert.equal(url, "https://example.com/api");
    assert.equal(options.method, "POST");
    assert.equal((options.headers as Record<string, string>)["x-test"], "1");
    assert.ok(options.signal instanceof AbortSignal);
  });

  it("returns a null body when the response text is empty", async () => {
    globalFetchMock.mockResolvedValue({ ok: true, status: 204, text: async () => "" });

    const result = await fetchJsonWithTimeout("https://example.com/api");
    assert.equal(result.body, null);
  });

  it("aborts the request signal once the timeout elapses", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    globalFetchMock.mockImplementation((_url: string, options: RequestInit) => {
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
    globalFetchMock.mockRejectedValue(new Error("network down"));
    await assert.rejects(() => fetchJsonWithTimeout("https://example.com/api"), /network down/);
  });
});

function response(status: number, bodyText: string, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    body: { cancel: () => Promise.resolve() },
    text: async () => bodyText
  };
}

/** Reads back the address the pinned lookup would hand to the socket for a given call. */
function pinnedAddresses(callIndex: number) {
  const lookup = agentOptions[callIndex].connect?.lookup as (
    host: string,
    options: { all: boolean },
    callback: (error: unknown, entries: { address: string }[]) => void
  ) => void;

  let captured: { address: string }[] = [];
  lookup("ignored", { all: true }, (_error, entries) => {
    captured = entries;
  });
  return captured.map((entry) => entry.address);
}

beforeEach(() => {
  fetchMock.mockReset();
  lookupMock.mockReset();
  agentOptions.length = 0;
  lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});

describe("fetchExternalJson", () => {
  it("returns the response, raw text, and parsed body", async () => {
    fetchMock.mockResolvedValue(response(200, '{"ok":true}'));

    const result = await fetchExternalJson("https://api.vendor.example/readings");

    assert.equal(result.response.status, 200);
    assert.equal(result.text, '{"ok":true}');
    assert.deepEqual(result.body, { ok: true });
    assert.equal(result.finalUrl, "https://api.vendor.example/readings");
  });

  it("rejects an internal service name before any connection is attempted", async () => {
    await assert.rejects(() => fetchExternalJson("http://minima:9005/vault"), EgressUrlError);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("rejects a non-http scheme before any connection is attempted", async () => {
    await assert.rejects(() => fetchExternalJson("file:///etc/passwd"), EgressUrlError);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("pins the validated address, so a resolver that answers differently on a second lookup cannot move the connection", async () => {
    lookupMock
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }])
      .mockResolvedValue([{ address: "172.30.0.3", family: 4 }]);
    fetchMock.mockResolvedValue(response(200, "{}"));

    await fetchExternalJson("https://api.vendor.example/readings");

    // One resolution only, and the socket is handed that answer rather than resolving again.
    assert.equal(lookupMock.mock.calls.length, 1);
    assert.deepEqual(pinnedAddresses(0), ["93.184.216.34"]);
    assert.ok(fetchMock.mock.calls[0][1].dispatcher);
  });

  it("never connects when the host resolves to an internal address", async () => {
    lookupMock.mockResolvedValue([{ address: "172.30.0.3", family: 4 }]);

    await assert.rejects(() => fetchExternalJson("https://api.vendor.example/readings"), EgressUrlError);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("does not follow redirects itself — it re-validates each Location hop", async () => {
    fetchMock
      .mockResolvedValueOnce(response(302, "", { location: "https://cdn.vendor.example/readings" }))
      .mockResolvedValueOnce(response(200, '{"hop":2}'));

    const result = await fetchExternalJson("https://api.vendor.example/readings");

    assert.equal(fetchMock.mock.calls[0][1].redirect, "manual");
    assert.equal(result.finalUrl, "https://cdn.vendor.example/readings");
    assert.deepEqual(result.body, { hop: 2 });
    assert.equal(lookupMock.mock.calls.length, 2);
  });

  it("rejects a Location header pointing at an internal host, without connecting to it", async () => {
    fetchMock.mockResolvedValueOnce(response(302, "", { location: "http://minima:9005/vault" }));

    await assert.rejects(() => fetchExternalJson("https://api.vendor.example/readings"), EgressUrlError);
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  it("rejects a relative Location that resolves onto a protected address", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    fetchMock.mockResolvedValueOnce(response(302, "", { location: "http://127.0.0.1:3000/api/health" }));

    await assert.rejects(() => fetchExternalJson("https://api.vendor.example/readings"), EgressUrlError);
  });

  it("gives up past the redirect hop cap", async () => {
    fetchMock.mockResolvedValue(response(302, "", { location: "https://api.vendor.example/next" }));

    await assert.rejects(() => fetchExternalJson("https://api.vendor.example/readings", {}, 5000, 2), /Too many redirects/);
    assert.equal(fetchMock.mock.calls.length, 3);
  });

  it("aborts the request once the timeout elapses", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: URL, options: { signal: AbortSignal }) => {
      capturedSignal = options.signal;
      return new Promise(() => {});
    });

    const pending = fetchExternalJson("https://api.vendor.example/readings", {}, 50);
    pending.catch(() => {});
    await vi.advanceTimersByTimeAsync(50);

    assert.equal(capturedSignal?.aborted, true);
    vi.useRealTimers();
  });
});
