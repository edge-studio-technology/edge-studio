import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PanelRight } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { cx } from "../../../../lib/cx";

/** Container: the rail pins at `@4xl` and becomes a drawer below it. */
const shellClass =
  "@container border-stroke-primary bg-surface-always-white flex h-screen min-h-0 flex-col overflow-hidden border shadow-[0_24px_60px_rgba(0,0,0,0.12)]";
const topbarClass =
  "border-stroke-secondary bg-surface-always-white pt-pad-relaxed px-pad-relaxed pb-pad-tight flex flex-col gap-detail-close border-b @4xl:flex-row @4xl:items-end @4xl:justify-between";
/** Full-bleed canvas area. */
const workspaceClass = "bg-surface-secondary relative min-h-0 flex-1 overflow-hidden";
const canvasFrameClass = "h-full min-h-0";
/** Pinned over the canvas when wide; a toggled drawer when narrow. */
const rightRailClass =
  "z-30 absolute top-pad-tight bottom-pad-tight right-pad-relaxed w-[360px] max-w-[calc(100%-2*var(--spacing-pad-relaxed))] min-h-0 flex-col data-[open=false]:hidden flex @4xl:z-10 @4xl:max-w-none @4xl:data-[open=false]:flex";
const rowActionsClass = "gap-detail-next flex flex-wrap items-center self-start @4xl:self-end";

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
  const [railOpen, setRailOpen] = useState(false);
  const hasSheet = Boolean(selectedSheet);

  // A sheet opens when a block is added or selected; get the drawer out of its way.
  useEffect(() => {
    if (hasSheet) setRailOpen(false);
  }, [hasSheet]);

  useEffect(() => {
    if (!railOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setRailOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [railOpen]);

  return (
    <section className={shellClass}>
      <div className={topbarClass}>
        <div className="gap-detail-close grid min-w-60 flex-1">
          <nav aria-label="Breadcrumb" className="type-body text-text-secondary">
            <Link to="/workflows" className="hover:text-text-primary">
              Workflows
            </Link>
            {" > "}
            <strong className="text-text-primary">{breadcrumbLabel}</strong>
          </nav>
          <div className="max-w-[360px]">{nameControl}</div>
        </div>
        <div className={cx("relative z-10", rowActionsClass)}>
          <Button
            type="button"
            variant="secondary"
            className="@4xl:hidden"
            aria-expanded={railOpen}
            aria-controls="workflow-rail"
            iconStart={<PanelRight aria-hidden />}
            onClick={() => setRailOpen((open) => !open)}
          >
            Toolkit
          </Button>
          {actions}
        </div>
      </div>
      {(statusStrip || notices) && (
        <div className="border-stroke-secondary bg-surface-primary gap-detail-close px-pad-relaxed py-pad-tight grid border-b">
          {statusStrip}
          {notices}
        </div>
      )}
      <div className={workspaceClass}>
        <div className={canvasFrameClass}>{canvas}</div>
        {railOpen ? (
          <div
            className="bg-overlay-light absolute inset-0 z-20 @4xl:hidden"
            aria-hidden
            data-testid="workflow-rail-backdrop"
            onPointerDown={() => setRailOpen(false)}
          />
        ) : null}
        <aside id="workflow-rail" data-open={railOpen} className={rightRailClass}>
          {rail}
        </aside>
        {selectedSheet}
        {bottom ? (
          <div className="left-pad-tight bottom-pad-tight md:left-detail-near md:bottom-detail-near right-pad-tight @4xl:right-[calc(360px+var(--spacing-pad-relaxed)+var(--spacing-pad-tight))] absolute z-10">
            {bottom}
          </div>
        ) : null}
      </div>
    </section>
  );
}
