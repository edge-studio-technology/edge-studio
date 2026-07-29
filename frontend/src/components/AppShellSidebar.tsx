import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Layers3, LogOut, MessageCircle, Minimize2, PanelLeftOpen } from "lucide-react";
import { nav } from "../app/nav";
import { cx } from "../lib/cx";
import { APP_NAME } from "../app/brand";

/** Below this width the sidebar stays collapsed. */
const EXPAND_MQ = "(min-width: 1024px)";

function BrandMark() {
  return (
    <div className="bg-grey-06 rounded-loose flex size-8 shrink-0 items-center justify-center">
      <Layers3 className="text-icon-inverse" size={18} />
    </div>
  );
}

function CollapsibleLabel({
  collapsed,
  children,
  className,
}: {
  collapsed: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden={collapsed}
      className={cx(
        "overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-200 ease-in-out",
        collapsed ? "pointer-events-none m-0 max-w-0 opacity-0" : "max-w-[12rem] opacity-100",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AppShellSidebar({
  pathname,
  onFeedback,
  onSignOut,
}: {
  pathname: string;
  onFeedback: () => void;
  onSignOut: () => void;
}) {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && !window.matchMedia(EXPAND_MQ).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(EXPAND_MQ);
    const sync = () => setCollapsed(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const activeId = useMemo(() => {
    const match = nav.find((item) => pathname === `/${item.id}`);
    return match?.id ?? "dashboard";
  }, [pathname]);

  return (
    <aside
      className={cx(
        "bg-surface-inverse text-text-inverse px-margin-tight py-margin-relaxed sticky top-0 flex h-screen shrink-0 flex-col justify-between overflow-hidden transition-[width] duration-300 ease-in-out",
        collapsed ? "w-20" : "w-80",
      )}
    >
      <div className="gap-separator-related flex min-h-0 w-full flex-1 flex-col">
        <div className="flex w-full items-center justify-between">
          <div
            className={cx(
              "gap-detail-close flex min-w-0 items-center overflow-hidden transition-[max-width,opacity] duration-200 ease-in-out",
              collapsed ? "pointer-events-none max-w-0 opacity-0" : "max-w-[14rem] opacity-100",
            )}
            aria-hidden={collapsed}
          >
            <BrandMark />
            <p className="type-title text-text-inverse m-0 whitespace-nowrap">{APP_NAME}</p>
          </div>
          <button
            type="button"
            className="rounded-loose bg-grey-06 text-icon-inverse hover:border-stroke-primary flex h-[44px] w-12 shrink-0 cursor-pointer items-center justify-center border border-transparent transition-colors"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <Minimize2 size={16} />}
          </button>
        </div>

        <nav className="gap-detail-tight flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto">
          {nav.map(({ id, label, icon: Icon, badge }) => {
            const isActive = activeId === id;
            return (
              <NavLink
                key={id}
                to={id === "marketplace" ? "/dashboard" : `/${id}`}
                title={collapsed ? label : undefined}
                className={cx(
                  "rounded-loose px-detail-close flex h-[44px] w-full items-center overflow-hidden border transition-[colors,border-color,gap] duration-200",
                  collapsed ? "gap-0" : "gap-detail-next",
                  isActive
                    ? "bg-surface-accent text-text-inverse border-transparent"
                    : "text-text-inverse hover:border-stroke-primary border-transparent",
                )}
              >
                <span
                  className={cx(
                    "flex min-w-0 items-center",
                    collapsed ? "gap-0" : "gap-detail-next",
                  )}
                >
                  <Icon size={16} aria-hidden className="shrink-0" />
                  <CollapsibleLabel collapsed={collapsed} className="type-body">
                    {label}
                  </CollapsibleLabel>
                </span>
                {badge ? (
                  <CollapsibleLabel
                    collapsed={collapsed}
                    className="ml-auto inline-flex items-center"
                  >
                    <span className="bg-surface-secondary text-text-primary type-meta px-detail-next inline-flex h-6 shrink-0 items-center justify-center overflow-hidden rounded-full leading-none">
                      {badge}
                    </span>
                  </CollapsibleLabel>
                ) : null}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className={cx("relative w-full", collapsed ? "flex flex-col items-center" : null)}>
        <div
          className={cx(
            "gap-detail-close flex w-full flex-col transition-[opacity,transform] duration-200 ease-in-out",
            collapsed
              ? "pointer-events-none absolute inset-x-0 bottom-0 translate-y-1 opacity-0"
              : "relative opacity-100",
          )}
          aria-hidden={collapsed}
        >
          <button
            type="button"
            className={cx(
              "rounded-loose bg-grey-06 px-detail-close text-text-inverse hover:border-stroke-primary flex h-[44px] w-full cursor-pointer items-center justify-center overflow-hidden border border-transparent transition-colors",
              collapsed ? "gap-0" : "gap-detail-next",
            )}
            onClick={onFeedback}
            tabIndex={collapsed ? -1 : undefined}
          >
            <MessageCircle size={16} className="shrink-0" />
            <CollapsibleLabel collapsed={collapsed} className="type-body">
              Feedback
            </CollapsibleLabel>
          </button>
          <button
            type="button"
            className={cx(
              "text-text-inverse hover:text-text-disabled inline-flex cursor-pointer items-center self-start overflow-hidden transition-colors",
              collapsed ? "gap-0" : "gap-detail-next",
            )}
            onClick={onSignOut}
            tabIndex={collapsed ? -1 : undefined}
          >
            <LogOut size={16} className="shrink-0" />
            <CollapsibleLabel collapsed={collapsed} className="type-body">
              Sign out
            </CollapsibleLabel>
          </button>
        </div>

        <div
          className={cx(
            "transition-[opacity,transform] duration-200 ease-in-out",
            collapsed
              ? "relative opacity-100"
              : "pointer-events-none absolute bottom-0 left-0 translate-y-1 opacity-0",
          )}
          aria-hidden={!collapsed}
        >
          <BrandMark />
        </div>
      </div>
    </aside>
  );
}
