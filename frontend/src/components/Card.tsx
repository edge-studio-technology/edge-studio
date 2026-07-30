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
        "bg-surface-always-white rounded-soft relative overflow-clip",
        size === "Compact" ? "p-inset-tight" : "p-inset-relaxed",
        className,
      )}
    >
      {children}
    </section>
  );
}
