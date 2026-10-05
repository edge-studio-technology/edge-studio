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
  async function handleCopy() {
    await navigator.clipboard?.writeText(value);
  }

  return (
    <button
      type="button"
      className={cx(
        mono ? "type-mono" : "type-body",
        "block min-w-0 max-w-full cursor-copy truncate border-0 bg-transparent p-0 text-left",
        className,
      )}
      title={value}
      aria-label={`Copy ${value}`}
      onClick={handleCopy}
    >
      {display ?? value}
    </button>
  );
}
