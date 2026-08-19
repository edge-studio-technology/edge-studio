const STORAGE_PREFIX = "edge-studio:";

/** Reactive boolean preference backed by localStorage, safe to read via useSyncExternalStore. */
export function createLocalBooleanSetting(key: string, defaultValue: boolean) {
  const storageKey = `${STORAGE_PREFIX}${key}`;
  const listeners = new Set<() => void>();

  function read(): boolean {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw === null ? defaultValue : raw === "true";
    } catch {
      return defaultValue;
    }
  }

  let value = read();

  function get() {
    return value;
  }

  function set(next: boolean) {
    value = next;
    try {
      window.localStorage.setItem(storageKey, next ? "true" : "false");
    } catch {
      // localStorage unavailable (private browsing, quota) — setting just won't persist.
    }
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { get, set, subscribe };
}
