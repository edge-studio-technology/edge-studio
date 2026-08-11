import { cx } from "../../lib/cx";

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
        size === "Compact" ? "p-pad-tight" : "p-pad-relaxed",
        className,
      )}
    >
      {children}
    </section>
  );
}
