import { cx } from "../../lib/cx";
import { shortHash } from "../../lib/format";

/** Truncated hash/address/id in a `<code>`, full value on hover via `title`. */
export function TruncatedHash({ value, className }: { value: string; className?: string }) {
  return (
    <code className={cx("type-mono text-text-secondary block truncate", className)} title={value}>
      {shortHash(value)}
    </code>
  );
}
