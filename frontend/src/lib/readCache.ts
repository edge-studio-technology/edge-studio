type Entry = { value?: unknown; observedAt: number; pending?: Promise<unknown> };
const entries = new Map<string, Entry>();
const MAX_ENTRIES = 32;
const MAX_SNAPSHOT_BYTES = 512 * 1024;
const invalidationListeners = new Set<() => void>();
export type ReadOptions = { force?: boolean };

export function clearReadCache(notify = false) {
  entries.clear();
  if (notify) for (const listener of invalidationListeners) listener();
}

export function subscribeReadCacheInvalidation(listener: () => void) {
  invalidationListeners.add(listener);
  return () => {
    invalidationListeners.delete(listener);
  };
}

function canRetain(value: unknown) {
  const pending = [value];
  let bytes = 0;
  let visited = 0;
  while (pending.length) {
    const item = pending.pop();
    if (++visited > 10000) return false;
    if (typeof item === "string") bytes += item.length * 2;
    else if (item && typeof item === "object") {
      for (const key in item) {
        bytes += key.length * 2 + 16;
        if (bytes > MAX_SNAPSHOT_BYTES || pending.length >= 10000) return false;
        pending.push((item as Record<string, unknown>)[key]);
      }
    } else bytes += 8;
    if (bytes > MAX_SNAPSHOT_BYTES) return false;
  }
  return true;
}

export function peekReadCache<T>(key: string): T | null {
  return (entries.get(key)?.value as T) ?? null;
}

export async function readCached<T>(
  key: string,
  load: () => Promise<T>,
  maxAgeMs: number,
  options?: ReadOptions,
): Promise<T> {
  let entry = entries.get(key);
  if (entry?.pending) return entry.pending as Promise<T>;
  if (!options?.force && entry?.value !== undefined && Date.now() - entry.observedAt < maxAgeMs)
    return entry.value as T;
  if (!entry) {
    entry = { observedAt: 0 };
    entries.set(key, entry);
    if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
  }
  const current = entry;
  const request = load()
    .then((value) => {
      if (entries.get(key) === current) {
        current.value = canRetain(value) ? value : undefined;
        current.observedAt = Date.now();
      }
      return value;
    })
    .finally(() => {
      if (current.pending === request) current.pending = undefined;
    });
  current.pending = request;
  return request;
}
