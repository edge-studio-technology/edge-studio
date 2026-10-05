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
        "type-mono relative inline-block max-w-full cursor-copy self-start rounded-tight border-0 p-0 text-left align-top transition-colors",
        copied ? "bg-transparent text-text-success" : "bg-transparent text-text-secondary",
        className,
      )}
      title={value}
      aria-label={copied ? `Copied ${value}` : `Copy ${value}`}
      onClick={handleCopy}
    >
      <span className={cx("block overflow-hidden text-ellipsis whitespace-nowrap", copied && "invisible")}>{shortHash(value)}</span>
      {copied && <span className="bg-feedback-positive/10 absolute top-0 left-0 w-max rounded-tight">Copied</span>}
    </button>
  );
}
