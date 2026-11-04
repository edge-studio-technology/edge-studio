import { afterEach, expect, it, vi } from "vitest";
import {
  clearReadCache,
  peekReadCache,
  readCached,
  subscribeReadCacheInvalidation,
} from "../../src/lib/readCache";

afterEach(() => vi.useRealTimers());

it("shares in-flight reads, reuses fresh results and forces a manual refresh", async () => {
  let resolve!: (value: number) => void;
  const load = vi.fn(
    () =>
      new Promise<number>((done) => {
        resolve = done;
      }),
  );
  const first = readCached("status", load, 30000);
  const second = readCached("status", load, 30000);
  expect(load).toHaveBeenCalledTimes(1);
  resolve(1);
  expect(await first).toBe(1);
  expect(await second).toBe(1);
  expect(await readCached("status", load, 30000)).toBe(1);
  load.mockResolvedValue(2);
  expect(await readCached("status", load, 30000, { force: true })).toBe(2);
});

it("retains a visible snapshot during stale refresh and errors without renewing freshness", async () => {
  vi.useFakeTimers();
  await readCached("status", async () => 1, 30000);
  vi.advanceTimersByTime(30000);
  let reject!: (error: Error) => void;
  const pending = readCached(
    "status",
    () =>
      new Promise<number>((_resolve, fail) => {
        reject = fail;
      }),
    30000,
  );
  expect(peekReadCache("status")).toBe(1);
  reject(new Error("offline"));
  await expect(pending).rejects.toThrow("offline");
  expect(peekReadCache("status")).toBe(1);
  expect(await readCached("status", async () => 2, 30000)).toBe(2);
});

it("does not restore invalidated session data when an old request resolves late", async () => {
  let resolve!: (value: string) => void;
  const old = readCached(
    "wallet",
    () =>
      new Promise<string>((done) => {
        resolve = done;
      }),
    30000,
  );
  clearReadCache();
  await readCached("wallet", async () => "new-session", 30000);
  resolve("old-session");
  await old;
  expect(peekReadCache("wallet")).toBe("new-session");
});

it("bounds retained query keys and unregisters mutation listeners", async () => {
  for (let page = 0; page < 33; page++) await readCached(`page:${page}`, async () => page, 30000);
  expect(peekReadCache("page:0")).toBeNull();
  expect(peekReadCache("page:32")).toBe(32);
  const listener = vi.fn();
  const unsubscribe = subscribeReadCacheInvalidation(listener);
  clearReadCache(true);
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  clearReadCache(true);
  expect(listener).toHaveBeenCalledTimes(1);
});

it("returns oversized data intact without retaining large history payloads", async () => {
  const payload = { items: [{ preview: "x".repeat(300000) }] };
  expect(await readCached("large", async () => payload, 30000)).toBe(payload);
  expect(peekReadCache("large")).toBeNull();
  const largeShape = Array.from({ length: 10001 }, () => null);
  expect(await readCached("deep", async () => largeShape, 30000)).toBe(largeShape);
  expect(peekReadCache("deep")).toBeNull();
});
