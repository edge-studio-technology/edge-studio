import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Bug, LogOut, MessageSquare, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "../app/brand";
import { nav } from "../app/nav";
import type { StatusOverview } from "../app/types";
import { FeedbackModal } from "../features/feedback/FeedbackModal";
import { AppShellSidebar } from "./AppShellSidebar";
import { useStatusOverviewRefresh } from "../features/status/useStatusOverviewRefresh";
import { useUpdateStatusRefresh } from "../features/update/useUpdateStatusRefresh";
import { cx } from "../lib/cx";
import { BrandMark } from "./BrandMark";
import { Button } from "./Button";
import { Card } from "./Card";
import { Clock } from "./Clock";
import { StatusDot, type StatusDotTone } from "./StatusDot";

function findService(overview: StatusOverview | null, name: string) {
  return overview?.services.find((service) => service.name === name);
}

function serviceTone(service: ReturnType<typeof findService>): StatusDotTone {
  if (!service) return "unknown";
  return service.ok ? "good" : "warn";
}

function ServiceDetail({
  service,
  generatedAt,
  refreshError,
}: {
  service: ReturnType<typeof findService>;
  generatedAt: string | undefined;
  refreshError: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="m-0 font-bold text-slate-900">{service ? service.status : "Not checked yet"}</p>
      {service?.error && <p className="m-0 text-red-600">{service.error}</p>}
      {generatedAt && (
        <p className="m-0 text-slate-400">Checked {new Date(generatedAt).toLocaleTimeString()}</p>
      )}
      {refreshError && (
        <p className="m-0 text-amber-600">Could not refresh — showing last known status.</p>
      )}
    </div>
  );
}

function StatusDots({
  minimaService,
  integritasService,
  generatedAt,
  refreshError,
}: {
  minimaService: ReturnType<typeof findService>;
  integritasService: ReturnType<typeof findService>;
  generatedAt: string | undefined;
  refreshError: string | null;
}) {
  return (
    <>
      <StatusDot label="Node" tone={serviceTone(minimaService)}>
        <ServiceDetail
          service={minimaService}
          generatedAt={generatedAt}
          refreshError={refreshError}
        />
      </StatusDot>
      <StatusDot label="Integritas" tone={serviceTone(integritasService)}>
        <ServiceDetail
          service={integritasService}
          generatedAt={generatedAt}
          refreshError={refreshError}
        />
      </StatusDot>
    </>
  );
}

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

  const { overview, error: statusRefreshError } = useStatusOverviewRefresh();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const minimaService = findService(overview, "minima");
  const integritasService = findService(overview, "integritas");

  const [updateAvailable, setUpdateAvailable] = useState(false);
  useUpdateStatusRefresh((status) => {
    // update-agent's own self-update runs automatically in the background after
    // a frontend/backend update and isn't something the user needs to act on —
    // counting it here would leave the badge lingering after a successful
    // update while the self-swap is still catching up.
    setUpdateAvailable(
      Boolean(status?.services.some((service) => service.service !== "update-agent" && !service.upToDate))
    );
  });

  const [debugPinging, setDebugPinging] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);

  function pingDebugEndpoint() {
    setDebugPinging(true);
    setDebugMessage(null);
    getDebugPing()
      .then((data) => setDebugMessage(data.message))
      .catch((error) => setDebugMessage(`Error: ${error.message}`))
      .finally(() => setDebugPinging(false));
  }

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
                <StatusDots
                  minimaService={minimaService}
                  integritasService={integritasService}
                  generatedAt={overview?.generatedAt}
                  refreshError={statusRefreshError}
                />
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
