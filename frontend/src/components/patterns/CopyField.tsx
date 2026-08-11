import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/Button";

export function CopyField({ label, value, description }: { label: string; value: string; description?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard failures in non-secure contexts
    }
  }

  return (
    <div className="border-stroke-secondary bg-surface-primary gap-detail-close rounded-soft p-detail-close flex items-center justify-between border">
      <div className="min-w-0">
        <p className="type-body text-text-tertiary m-0">{label}</p>
        <p className="type-body text-text-primary mt-detail-tight m-0 truncate">{value}</p>
        {description ? <p className="type-meta text-text-secondary mt-detail-tight m-0">{description}</p> : null}
      </div>
      <Button variant="ghost" iconEnd={copied ? <Check aria-hidden /> : <Copy aria-hidden />} onClick={handleCopy}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
