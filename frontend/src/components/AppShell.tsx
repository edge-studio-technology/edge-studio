import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { nav } from "../app/nav";
import type { StatusOverview, Tone } from "../app/types";
import { getDebugPing } from "../features/debug/debugApi";
import { FeedbackModal } from "../features/feedback/FeedbackModal";
import { AppShellSidebar } from "./AppShellSidebar";
import { useStatusOverviewRefresh } from "../features/status/useStatusOverviewRefresh";
import { useUpdateStatusRefresh } from "../features/update/useUpdateStatusRefresh";
import { StatusBar, type StatusBarItem } from "./StatusBar";

function findService(overview: StatusOverview | null, name: string) {
  return overview?.services.find((service) => service.name === name);
}

type OverviewService = NonNullable<ReturnType<typeof findService>>;

function serviceDetailMessage(service: OverviewService | undefined, id: string): string {
  if (!service) return "Status has not been checked yet.";
  if (service.ok) return "Last check succeeded.";
  if (id === "integritas") {
    return "Reconnect Integritas in Account to restore the connection.";
  }
  if (service.error) return service.error;
  if (service.status === "error") return "Something went wrong during the last check.";
  return `Current state: ${service.status.replace(/_/g, " ")}.`;
}

function statusBarItem({
  id,
  okLabel,
  badLabel,
  pendingLabel,
  service,
  generatedAt,
  refreshError,
}: {
  id: string;
  okLabel: string;
  badLabel: string;
  pendingLabel: string;
  service: OverviewService | undefined;
  generatedAt: string | undefined;
  refreshError: string | null;
}): StatusBarItem {
  const tone: Tone = !service ? "neutral" : service.ok ? "good" : "warn";
  const label = !service ? pendingLabel : service.ok ? okLabel : badLabel;

  const detailBody = (
    <div className="flex flex-col gap-1">
      <p className="m-0">{serviceDetailMessage(service, id)}</p>
      {generatedAt ? (
        <p className="m-0">Checked {new Date(generatedAt).toLocaleTimeString()}</p>
      ) : null}
      {refreshError ? (
        <p className="text-text-warning m-0">Could not refresh — showing last known status.</p>
      ) : null}
    </div>
  );

  return {
    id,
    label,
    tone,
    detailTitle: label,
    detailBody,
  };
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
      Boolean(
        status?.services.some((service) => service.service !== "update-agent" && !service.upToDate),
      ),
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

  const statusItems: StatusBarItem[] = [
    statusBarItem({
      id: "node",
      okLabel: "Node online",
      badLabel: "Node offline",
      pendingLabel: "Node",
      service: minimaService,
      generatedAt: overview?.generatedAt,
      refreshError: statusRefreshError,
    }),
    statusBarItem({
      id: "integritas",
      okLabel: "Integritas connected",
      badLabel: "Integritas disconnected",
      pendingLabel: "Integritas",
      service: integritasService,
      generatedAt: overview?.generatedAt,
      refreshError: statusRefreshError,
    }),
  ];

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <AppShellSidebar
          pathname={pathname}
          onFeedback={() => setFeedbackOpen(true)}
          onSignOut={onSignOut}
        />

        <main className="min-w-0 flex-1">
          <StatusBar items={statusItems} />
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
