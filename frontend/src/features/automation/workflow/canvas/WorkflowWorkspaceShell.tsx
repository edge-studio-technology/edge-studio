import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cx } from "../../../../lib/cx";

const shellClass =
  "border-stroke-primary bg-surface-always-white flex h-screen min-h-0 flex-col overflow-hidden border shadow-[0_24px_60px_rgba(0,0,0,0.12)]";
const topbarClass =
  "border-stroke-secondary bg-surface-always-white pt-margin-relaxed px-margin-relaxed pb-margin-tight flex flex-col gap-detail-close border-b lg:flex-row lg:items-end lg:justify-between";
const workspaceClass = "bg-surface-secondary relative min-h-0 flex-1 overflow-hidden";
const canvasFrameClass = "h-full min-h-0";
const leftRailClass = "z-10 xl:absolute xl:top-margin-tight xl:left-detail-near xl:w-[320px]";
const rightRailClass = "z-10 xl:absolute xl:top-margin-tight xl:right-detail-near xl:w-[360px]";
const rowActionsClass = "gap-detail-next flex flex-wrap items-center self-end";

export function WorkflowWorkspaceShell({
  breadcrumbLabel,
  nameControl,
  actions,
  canvas,
  leftRail,
  rail,
  selectedSheet,
  bottom,
  notices,
}: {
  breadcrumbLabel: string;
  nameControl: ReactNode;
  actions?: ReactNode;
  canvas: ReactNode;
  leftRail?: ReactNode;
  rail: ReactNode;
  selectedSheet?: ReactNode;
  bottom?: ReactNode;
  notices?: ReactNode;
}) {
  return (
    <section className={shellClass}>
      <div className={topbarClass}>
        <div className="gap-detail-close grid min-w-0 flex-1">
          <nav aria-label="Breadcrumb" className="type-body text-text-secondary">
            <Link to="/automation" className="hover:text-text-primary">
              Automation
            </Link>
            {" > "}
            <strong className="text-text-primary">{breadcrumbLabel}</strong>
          </nav>
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
        {leftRail && <div className={leftRailClass}>{leftRail}</div>}
        <div className={rightRailClass}>{rail}</div>
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
