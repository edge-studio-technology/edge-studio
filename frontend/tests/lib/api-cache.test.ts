import { afterEach, expect, it, vi } from "vitest";
import { getCachedJson, getJson, postJson, postForm } from "../../src/lib/api";
import { subscribeReadCacheInvalidation } from "../../src/lib/readCache";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function reply(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}

it("reuses only selected reads and keeps list refreshes live", async () => {
  const fetchMock = vi.fn().mockImplementation(async () => reply({ items: [], state: "running" }));
  vi.stubGlobal("fetch", fetchMock);
  await getJson("/api/minima/status");
  await getJson("/api/minima/status");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await getJson("/api/data-sources");
  await getJson("/api/data-sources");
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(getCachedJson("/api/data-sources")).toEqual({ items: [], state: "running" });
  await getJson("/api/auth/me");
  await getJson("/api/auth/me");
  expect(fetchMock).toHaveBeenCalledTimes(5);
});

it("uses three-second reuse during telemetry sampling and thirty seconds while healthy", async () => {
  vi.useFakeTimers();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(reply({ state: "running", container: { metricsPending: true } }))
    .mockResolvedValueOnce(reply({ state: "running", container: { metricsPending: false } }))
    .mockImplementation(async () => reply({ state: "running" }));
  vi.stubGlobal("fetch", fetchMock);
  await getJson("/api/minima/status");
  vi.advanceTimersByTime(2999);
  await getJson("/api/minima/status");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);
  await getJson("/api/minima/status");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(29999);
  await getJson("/api/minima/status");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await getJson("/api/minima/status", { force: true });
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("clears snapshots before and after JSON/form mutations, including rejected credentials", async () => {
  const fetchMock = vi.fn().mockImplementation(async () => reply({ tokens: [] }));
  vi.stubGlobal("fetch", fetchMock);
  await getJson("/api/wallet");
  fetchMock.mockImplementationOnce(async () => {
    expect(getCachedJson("/api/wallet")).toBeNull();
    await getJson("/api/wallet");
    return reply({ error: "rejected" }, 403);
  });
  await expect(postJson("/api/wallet/send-payment", {})).rejects.toThrow("rejected");
  expect(getCachedJson("/api/wallet")).toBeNull();
  await getJson("/api/wallet");
  await postForm("/api/minima/backups/restore", new FormData());
  expect(getCachedJson("/api/wallet")).toBeNull();
});

it("clears previous user data on session expiry", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(reply({ tokens: [] }))
    .mockResolvedValueOnce(reply({ error: "Unauthorized" }, 401));
  vi.stubGlobal("fetch", fetchMock);
  await getJson("/api/wallet");
  await expect(getJson("/api/auth/me")).rejects.toThrow("Unauthorized");
  expect(getCachedJson("/api/wallet")).toBeNull();
});

it("lets authentication flows own their confirmation and logout navigation", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => reply({ success: true })),
  );
  await getJson("/api/wallet");
  const listener = vi.fn();
  const unsubscribe = subscribeReadCacheInvalidation(listener);
  try {
    await postJson("/api/auth/settings/password", { currentPassword: "test", newPassword: "test" });
    expect(getCachedJson("/api/wallet")).toBeNull();
    expect(listener).not.toHaveBeenCalled();
    await postJson("/api/auth/logout");
    expect(listener).not.toHaveBeenCalled();
    await postJson("/api/setup/connect/skip");
    expect(listener).not.toHaveBeenCalled();
  } finally {
    unsubscribe();
  }
});
