import type { ReactNode } from "react";
import { cx } from "../../../lib/cx";

const shellClass =
  "border-stroke-primary bg-surface-always-white flex h-screen min-h-0 flex-col overflow-hidden border shadow-[0_24px_60px_rgba(0,0,0,0.12)]";
const topbarClass =
  "border-stroke-secondary bg-surface-always-white px-margin-tight py-detail-close flex flex-col gap-detail-close border-b lg:flex-row lg:items-start lg:justify-between xl:items-center";
const workspaceClass = "bg-surface-secondary relative min-h-0 flex-1 overflow-hidden";
const canvasFrameClass = "h-full min-h-0";
const railClass = "z-10 xl:absolute xl:top-margin-tight xl:right-detail-near xl:w-[360px]";
const rowActionsClass = "gap-detail-next flex flex-wrap items-center";

export function WorkflowWorkspaceShell({
  breadcrumbLabel,
  nameControl,
  actions,
  canvas,
  rail,
  selectedSheet,
  bottom,
  notices,
}: {
  breadcrumbLabel: string;
  nameControl: ReactNode;
  actions?: ReactNode;
  canvas: ReactNode;
  rail: ReactNode;
  selectedSheet?: ReactNode;
  bottom?: ReactNode;
  notices?: ReactNode;
}) {
  return (
    <section className={shellClass}>
      <div className={topbarClass}>
        <div className="gap-detail-next grid min-w-0 flex-1">
          <p className="type-meta text-text-secondary m-0">
            Automation <span aria-hidden>&gt;</span>{" "}
            <strong className="text-text-primary">{breadcrumbLabel}</strong>
          </p>
          <div className="max-w-[360px]">{nameControl}</div>
        </div>
        {actions && <div className={cx("relative z-10", rowActionsClass)}>{actions}</div>}
      </div>
      {notices && (
        <div className="border-stroke-secondary bg-surface-primary px-margin-tight py-detail-next gap-detail-next grid border-b">
          {notices}
        </div>
      )}
      <div className={workspaceClass}>
        <div className={canvasFrameClass}>{canvas}</div>
        <div className={railClass}>{rail}</div>
        {selectedSheet}
        {bottom && (
          <div className="inset-x-margin-tight bottom-margin-tight md:inset-x-detail-near md:bottom-detail-near absolute z-10">
            {bottom}
          </div>
        )}
      </div>
    </section>
  );
}
