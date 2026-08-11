import type { ReactNode } from "react";
import type { Tone } from "../app/types";
import { cx } from "../lib/cx";
import { Clock } from "./Clock";
import { Pill } from "./Pill";
import { Tooltip } from "./ui/Tooltip";

export type StatusBarItem = {
  id: string;
  label: string;
  tone: Tone;
  detailTitle?: ReactNode;
  detailBody?: ReactNode;
};

export function StatusBar({ items, className }: { items: StatusBarItem[]; className?: string }) {
  return (
    <div
      className={cx(
        "bg-surface-primary border-stroke-secondary p-margin-tight gap-detail-close sticky top-0 z-20 flex w-full items-start justify-between border-b shadow-[0_8px_16px_rgba(15,23,42,0.06)]",
        className,
      )}
      role="status"
      aria-label="System status"
    >
      <div className="gap-detail-tight flex flex-wrap items-center">
        {items.map((item) => {
          const pill = (
            <Pill tone={item.tone} indicator className="cursor-pointer">
              {item.label}
            </Pill>
          );

          if (item.detailTitle == null) {
            return <span key={item.id}>{pill}</span>;
          }

          return (
            <Tooltip
              key={item.id}
              title={item.detailTitle}
              body={item.detailBody}
              placement="bottom"
            >
              {pill}
            </Tooltip>
          );
        })}
      </div>
      <Clock />
    </div>
  );
}
