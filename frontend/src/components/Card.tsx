import { cx } from "../lib/cx";

export function Card({
  children,
  className = "",
  size = "Default",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "Default" | "Compact";
}) {
  return (
    <section
      className={cx(
        "bg-surface-always-white rounded-soft relative flex flex-col items-start overflow-clip gap-detail-close",
        size === "Compact" ? "p-margin-tight" : "p-margin-relaxed",
        className,
      )}
    >
      {children}
    </section>
  );
}
