import type { ReactNode } from "react";

export function ListDisclosure({
  title,
  count,
  max,
  divider = true,
  children,
}: {
  title: string;
  count: number;
  max?: number;
  divider?: boolean;
  children: ReactNode;
}) {
  return (
    <details className={divider ? "group border-t border-slate-200 pt-4" : "group pt-4"}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 [&::-webkit-details-marker]:hidden">
        <span>
          {title} ({max != null ? `${count}/${max}` : count})
        </span>
        <span className="text-slate-400 transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="grid gap-1.5 pt-3">{children}</div>
    </details>
  );
}
