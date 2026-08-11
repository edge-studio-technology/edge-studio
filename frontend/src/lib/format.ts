/** Truncates a long hash/address/id for display, keeping any Mx/0x prefix visible. */
export function shortHash(value: string): string {
  if (value.length <= 18) return value;
  if (value.startsWith("Mx")) return `${value.slice(0, 8)}…${value.slice(-6)}`;
  if (value.startsWith("0x")) return `${value.slice(0, 10)}…${value.slice(-6)}`;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export function formatSize(size?: number) {
  if (size === undefined) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Trim noisy Minima decimal strings for display (e.g. 0.006000000… → 0.006).
 * Use maxDecimals 6 on the dashboard, 12 on the wallet page.
 */
export function formatMinimaAmount(value: string, maxDecimals = 6): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === ".") return "0";
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [intPart = "0", fracPart = ""] = unsigned.split(".");
  const clipped = fracPart.slice(0, maxDecimals).replace(/0+$/, "");
  const formatted = clipped ? `${intPart || "0"}.${clipped}` : intPart || "0";
  return negative ? `-${formatted}` : formatted;
}
