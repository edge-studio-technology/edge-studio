import { cx } from "../lib/cx";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "bg-surface-always-white rounded-soft p-margin-relaxed",
        className,
      )}
    >
      {children}
    </section>
  );
}
