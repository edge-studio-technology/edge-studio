import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cx } from "../../lib/cx";
import { useToast } from "../ToastProvider";
import { IconButton } from "../ui/Button";

/** Mono value chip with a copy IconButton (addresses, token IDs, hashes). */
export function CopyableCode({ value, className }: { value: string; className?: string }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      showToast({ tone: "success", title: "Copied", message: "Value copied to clipboard.", timeoutMs: 2500 });
    } catch {
      showToast({
        tone: "error",
        title: "Copy failed",
        message: "Clipboard is unavailable in this context.",
        timeoutMs: 5000,
      });
    }
  }

  return (
    <div
      className={cx(
        "bg-surface-secondary gap-detail-next rounded-loose p-pad-close flex items-center",
        className,
      )}
    >
      <code className="type-mono text-text-primary min-w-0 flex-1 break-all">{value}</code>
      <IconButton
        type="button"
        size="compact"
        variant="secondary"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        title={copied ? "Copied" : "Copy"}
        className="shrink-0"
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      </IconButton>
    </div>
  );
}
