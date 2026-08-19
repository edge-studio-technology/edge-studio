import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cx } from "../../../../lib/cx";

const shellClass =
  "border-stroke-primary bg-surface-always-white flex h-screen min-h-0 flex-col overflow-hidden border shadow-[0_24px_60px_rgba(0,0,0,0.12)]";
const topbarClass =
  "border-stroke-secondary bg-surface-always-white pt-pad-relaxed px-pad-relaxed pb-pad-tight flex flex-col gap-detail-close border-b lg:flex-row lg:items-end lg:justify-between";
/** Full-bleed canvas area. */
const workspaceClass = "bg-surface-secondary relative min-h-0 flex-1 overflow-hidden";
const canvasFrameClass = "h-full min-h-0";
/** Toolkit always visible over the canvas. */
const rightRailClass =
  "z-10 absolute top-pad-tight bottom-pad-tight right-pad-relaxed flex w-[360px] min-h-0 flex-col";
const rowActionsClass = "gap-detail-next flex flex-wrap items-center self-end";

export function WorkflowWorkspaceShell({
  breadcrumbLabel,
  nameControl,
  actions,
  canvas,
  rail,
  selectedSheet,
  bottom,
  statusStrip,
  notices,
}: {
  breadcrumbLabel: string;
  nameControl: ReactNode;
  actions?: ReactNode;
  canvas: ReactNode;
  rail: ReactNode;
  selectedSheet?: ReactNode;
  bottom?: ReactNode;
  /** Meta status pills. */
  statusStrip?: ReactNode;
  notices?: ReactNode;
}) {
  return (
    <section className={shellClass}>
      <div className={topbarClass}>
        <div className="gap-detail-close grid min-w-0 flex-1">
          <nav aria-label="Breadcrumb" className="type-body text-text-secondary">
            <Link to="/workflows" className="hover:text-text-primary">
              Workflows
            </Link>
            {" > "}
            <strong className="text-text-primary">{breadcrumbLabel}</strong>
          </nav>
          <div className="max-w-[360px]">{nameControl}</div>
        </div>
        {actions && <div className={cx("relative z-10", rowActionsClass)}>{actions}</div>}
      </div>
      {(statusStrip || notices) && (
        <div className="border-stroke-secondary bg-surface-primary gap-detail-close px-pad-relaxed py-pad-tight grid border-b">
          {statusStrip}
          {notices}
        </div>
      )}
      <div className={workspaceClass}>
        <div className={canvasFrameClass}>{canvas}</div>
        <aside className={rightRailClass}>{rail}</aside>
        {selectedSheet}
        {bottom ? (
          <div className="left-pad-tight bottom-pad-tight md:left-detail-near md:bottom-detail-near absolute right-[calc(360px+var(--spacing-pad-relaxed)+var(--spacing-pad-tight))] z-10">
            {bottom}
          </div>
        ) : null}
      </div>
    </section>
  );
}
