import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cx } from "../../lib/cx";
import { IconButton } from "../ui/Button";

export function CodeBlock({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={cx("bg-surface-inverse border-stroke-secondary rounded-soft relative min-w-0 max-w-full overflow-hidden border", className)}>
      <pre className="type-mono text-text-inverse m-0 min-w-0 max-w-full max-h-80 overflow-auto p-pad-tight pr-12 whitespace-pre">
        <code>{value}</code>
      </pre>
      <IconButton
        type="button"
        size="compact"
        variant="secondary"
        onClick={() => void copy()}
        aria-label={copied ? "Copied" : "Copy code"}
        title={copied ? "Copied" : "Copy code"}
        className="top-detail-tight right-detail-tight absolute"
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      </IconButton>
    </div>
  );
}
