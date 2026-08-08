import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { ScrollArea } from "../ui/ScrollArea";

/** Unused as of the settings-page ListDisclosure -> DataTable migration. Possible deprecation candidate — keep until we decide whether disclosure-style lists are still wanted. */
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
        <ChevronRight
          size={18}
          className={cx("shrink-0 text-slate-400 transition-transform", open && "rotate-90")}
        />
        <span>
          {title} ({max != null ? `${count}/${max}` : count})
        </span>
      </summary>
      <ScrollArea className="mt-3 h-80 rounded-soft border border-slate-200 bg-white">
        <div className="divide-y divide-slate-200 p-2">{children}</div>
      </ScrollArea>
    </details>
  );
}
