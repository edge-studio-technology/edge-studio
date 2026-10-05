import { useState } from "react";
import { cx } from "../../lib/cx";

export function CopyableTruncatedText({
  value,
  display,
  className,
  mono = false,
}: {
  value: string;
  display?: string;
  className?: string;
  mono?: boolean;
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
        mono ? "type-mono" : "type-body",
        "inline-block max-w-full cursor-copy truncate rounded-tight border-0 p-0 text-left align-top transition-colors",
        copied ? "bg-feedback-positive/10 text-text-success" : "bg-transparent",
        className,
      )}
      title={value}
      aria-label={copied ? `Copied ${value}` : `Copy ${value}`}
      onClick={handleCopy}
    >
      {copied ? "Copied" : display ?? value}
    </button>
  );
}
