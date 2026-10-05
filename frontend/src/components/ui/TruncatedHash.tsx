import { cx } from "../../lib/cx";
import { shortHash } from "../../lib/format";

/** Truncated hash/address/id in a `<code>`, full value on hover via `title`. */
export function TruncatedHash({ value, className }: { value: string; className?: string }) {
  async function handleCopy() {
    await navigator.clipboard?.writeText(value);
  }

  return (
    <button
      type="button"
      className={cx(
        "type-mono text-text-secondary block cursor-copy border-0 bg-transparent p-0 text-left whitespace-nowrap",
        className,
      )}
      title={value}
      aria-label={`Copy ${value}`}
      onClick={handleCopy}
    >
      {shortHash(value)}
    </button>
  );
}
