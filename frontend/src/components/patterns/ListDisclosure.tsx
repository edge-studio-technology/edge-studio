import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cx } from "../../lib/cx";

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
  const [open, setOpen] = useState(false);

  return (
    <details
      className={divider ? "border-t border-slate-200 pt-4" : "pt-4"}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-slate-500 [&::-webkit-details-marker]:hidden">
        <ChevronRight size={18} className={cx("shrink-0 text-slate-400 transition-transform", open && "rotate-90")} />
        <span>
          {title} ({max != null ? `${count}/${max}` : count})
        </span>
      </summary>
      <div className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">{children}</div>
    </details>
  );
}
