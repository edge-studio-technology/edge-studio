import { useState } from "react";
import { cx } from "../../lib/cx";

export function CopyableTruncatedText({
  value,
  display,
  className,
  mono = false,
  emphasis = false,
  meta = false,
  tone = "primary",
}: {
  value: string;
  display?: string;
  className?: string;
  mono?: boolean;
  emphasis?: boolean;
  meta?: boolean;
  tone?: "primary" | "secondary" | "error";
}) {
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
        mono ? "type-mono" : meta ? "type-meta" : emphasis ? "type-body-em" : "type-body",
        "relative inline-block max-w-full cursor-copy self-start rounded-tight border-0 p-0 text-left align-top transition-colors",
        copied ? "bg-transparent text-text-success" : tone === "secondary" ? "bg-transparent text-text-secondary" : tone === "error" ? "bg-transparent text-text-error" : "bg-transparent text-text-primary",
        className,
      )}
      title={value}
      aria-label={copied ? `Copied ${value}` : `Copy ${value}`}
      onClick={handleCopy}
    >
      <span className={cx("block truncate", copied && "invisible")}>{display ?? value}</span>
      {copied && <span className="bg-feedback-positive/10 absolute top-0 left-0 w-max rounded-tight">Copied</span>}
    </button>
  );
}
