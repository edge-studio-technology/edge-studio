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
        "bg-surface-primary p-margin-tight gap-detail-close flex w-full items-start justify-between",
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
