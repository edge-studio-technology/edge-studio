import { ScrollArea } from "../ui/ScrollArea";
import { cx } from "../../lib/cx";

/** Inverse mono pretty-printed JSON block for embedding in modals, disclosures, or panels. */
export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  return (
    <ScrollArea
      className={cx(
        "border-stroke-secondary bg-surface-inverse rounded-soft p-pad-close max-h-80 w-full border",
        className,
      )}
    >
      <pre className="type-mono text-text-inverse m-0 leading-[1.5] [overflow-wrap:anywhere] whitespace-pre-wrap [tab-size:2]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </ScrollArea>
  );
}
