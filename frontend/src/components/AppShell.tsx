import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { nav } from "../app/nav";
import type { StatusOverview } from "../app/types";
import { FeedbackModal } from "../features/feedback/FeedbackModal";
import { AppShellSidebar } from "./AppShellSidebar";
import { Clock } from "./Clock";
import { StatusBadge } from "./StatusBadge";

export function AppShell({
  onSignOut,
  children,
}: {
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const { pathname, search } = useLocation();

  const activeItem = useMemo(
    () => nav.find((navItem) => pathname === `/${navItem.id}`) ?? nav[0],
    [pathname],
  );

  const [overview, setOverview] = useState<StatusOverview | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    fetch("/api/status/overview")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<StatusOverview>;
      })
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);

  const serviceIsOk = (name: string) =>
    Boolean(overview?.services.find((service) => service.name === name)?.ok);

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <AppShellSidebar
          pathname={pathname}
          onFeedback={() => setFeedbackOpen(true)}
          onSignOut={onSignOut}
        />

        <main className="min-w-0 flex-1 p-2">
          <header className="flex flex-col gap-4 rounded border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="flex items-center gap-3">
                <div>
                  <p className="m-0 text-[0.86rem] text-slate-400">Current section</p>
                  <h2 className="m-0 mt-0.5 text-xl font-extrabold tracking-[-0.03em] text-slate-950">
                    {activeItem.label}
                  </h2>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge ok={serviceIsOk("backend")}>Node online</StatusBadge>
                <StatusBadge ok={serviceIsOk("minima")}>Wallet ready</StatusBadge>
                <StatusBadge ok={serviceIsOk("integritas")}>Integritas connected</StatusBadge>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
              <Clock />
            </div>
          </header>

          {children}
        </main>
      </div>
      {feedbackOpen && (
        <FeedbackModal
          pagePath={`${pathname}${search}`}
          pageLabel={activeItem.label}
          onClose={() => setFeedbackOpen(false)}
        />
      )}
    </div>
  );
}
