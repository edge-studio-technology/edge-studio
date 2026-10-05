import { useState } from "react";
import { cx } from "../../lib/cx";
import { shortHash } from "../../lib/format";

/** Truncated hash/address/id in a `<code>`, full value on hover via `title`. */
export function TruncatedHash({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      type="button"
      className={cx(
        "type-mono block cursor-copy rounded-tight border-0 p-0 text-left whitespace-nowrap transition-colors",
        copied ? "bg-feedback-positive/10 text-text-success" : "bg-transparent text-text-secondary",
        className,
      )}
      title={value}
      aria-label={copied ? `Copied ${value}` : `Copy ${value}`}
      onClick={handleCopy}
    >
      {copied ? "Copied" : shortHash(value)}
    </button>
  );
}
