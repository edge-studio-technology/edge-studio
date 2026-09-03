import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteJson, getJson, patchJson, postForm, postJson, setUnauthorizedHandler } from "../../src/lib/api";

function jsonResponse(body: unknown, init: { status?: number; url?: string } = {}) {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    url: init.url ?? "http://localhost/api/thing",
    json: () => Promise.resolve(body),
  } as Response;
}

describe("lib/api", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setUnauthorizedHandler(null);
  });

  it("getJson sends credentials and returns parsed JSON on success", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ hello: "world" }));

    const result = await getJson<{ hello: string }>("/api/thing");

    expect(fetchMock).toHaveBeenCalledWith("/api/thing", { credentials: "include" });
    expect(result).toEqual({ hello: "world" });
  });

  it("postJson sends a JSON body with the POST method", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await postJson("/api/thing", { a: 1 });

    expect(fetchMock).toHaveBeenCalledWith("/api/thing", {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });
  });

  it("postJson omits the body when none is given", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await postJson("/api/thing");

    expect(fetchMock).toHaveBeenCalledWith("/api/thing", {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: undefined,
    });
  });

  it("patchJson sends a JSON body with the PATCH method", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await patchJson("/api/thing", { a: 1 });

    expect(fetchMock).toHaveBeenCalledWith("/api/thing", {
      credentials: "include",
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });
  });

  it("deleteJson omits headers/body when no body is given", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await deleteJson("/api/thing");

    expect(fetchMock).toHaveBeenCalledWith("/api/thing", {
      credentials: "include",
      method: "DELETE",
      headers: undefined,
      body: undefined,
    });
  });

  it("postForm sends a FormData body without JSON headers", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    const form = new FormData();

    await postForm("/api/upload", form);

    expect(fetchMock).toHaveBeenCalledWith("/api/upload", {
      credentials: "include",
      method: "POST",
      body: form,
    });
  });

  it("throws an ApiError with status and details on a non-ok response", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "bad request", errorCode: "BAD" }, { status: 400 })
    );

    await expect(getJson("/api/thing")).rejects.toMatchObject({
      message: "bad request",
      status: 400,
      errorCode: "BAD",
    });
  });

  it("falls back to a generic message when the error body can't be parsed", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      url: "http://localhost/api/thing",
      json: () => Promise.reject(new Error("not json")),
    } as unknown as Response);

    await expect(getJson("/api/thing")).rejects.toMatchObject({
      status: 500,
      message: "Unknown error",
    });
  });

  it("calls the unauthorized handler on a 401 for a protected route without errorCode", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(jsonResponse({ error: "unauthorized" }, { status: 401 }));

    await expect(getJson("/api/thing")).rejects.toBeTruthy();

    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not call the unauthorized handler for a 401 on the login route", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "bad creds" }, { status: 401, url: "http://localhost/api/auth/login" })
    );

    await expect(getJson("/api/auth/login")).rejects.toBeTruthy();

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not call the unauthorized handler for a 401 that carries an app errorCode", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "invalid pin", errorCode: "INVALID_PIN" }, { status: 401 })
    );

    await expect(getJson("/api/thing")).rejects.toBeTruthy();

    expect(handler).not.toHaveBeenCalled();
  });
});
