import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Cable, Check, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { APP_NAME } from "../../app/names";
import { ErrorAlert } from "../../components/patterns/ErrorAlert";
import { LoadingState } from "../../components/patterns/LoadingState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { listAutomationWorkflows } from "../automation/automationApi";
import { listDataSources } from "../data-sources/dataSourcesApi";
import { cx } from "../../lib/cx";

type NextActionState =
  | { status: "loading" }
  | { status: "ready"; deviceCount: number; workflowCount: number }
  | { status: "error" };

export function DashboardNextAction() {
  const navigate = useNavigate();
  const [state, setState] = useState<NextActionState>({ status: "loading" });

  useEffect(() => {
    Promise.all([
      listDataSources().then((res) => res.items.length),
      listAutomationWorkflows().then(
        (res) => res.items.filter((workflow) => !workflow.archived).length,
      ),
    ])
      .then(([deviceCount, workflowCount]) => {
        setState({ status: "ready", deviceCount, workflowCount });
      })
      .catch(() => setState({ status: "error" }));
  }, []);

  if (state.status === "loading") {
    return (
      <Card className="w-full">
        <LoadingState
          title="Checking your next step"
          description="This should take a few seconds."
          className="min-h-48 rounded-none border-0 bg-transparent p-0"
        />
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <ErrorAlert title="Dashboard setup couldn't be loaded" className="w-full max-w-none!">
        We couldn't check your devices and workflows. Refresh the page to try again.
      </ErrorAlert>
    );
  }

  const hasDevices = state.deviceCount > 0;
  const hasWorkflows = state.workflowCount > 0;
  if (hasDevices && hasWorkflows) return null;

  const step = hasDevices ? 2 : 1;

  return (
    <Card className="gap-detail-near flex w-full flex-col">
      <header className="gap-detail-next flex max-w-2xl flex-col">
        <h2 className="type-title text-text-primary m-0">
          {step === 1 ? "Connect a device to get started" : "Create your first workflow"}
        </h2>
        <p className="type-body text-text-secondary m-0">
          {APP_NAME} connects device data, proves it with Integritas, runs workflows, and settles
          value on Minima.
        </p>
      </header>

      <ol className="m-0 grid max-w-xl list-none gap-0 p-0">
        <Step
          number={1}
          icon={Cable}
          title="Connect devices"
          detail="Add a sensor, API, webhook, MQTT, or GPIO source."
          state={hasDevices ? "done" : "current"}
          showConnector
        />
        <Step
          number={2}
          icon={Workflow}
          title="Create a workflow"
          detail="Automate what happens when device data or proofs arrive."
          state={hasDevices ? "current" : "upcoming"}
        />
      </ol>

      <div className="gap-detail-next flex flex-wrap items-center">
        {step === 1 ? (
          <Button
            type="button"
            variant="accent"
            iconStart={<Cable aria-hidden="true" />}
            iconEnd={<ArrowRight aria-hidden="true" />}
            onClick={() => navigate("/data")}
          >
            Connect devices
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="accent"
              iconStart={<Workflow aria-hidden="true" />}
              iconEnd={<ArrowRight aria-hidden="true" />}
              onClick={() => navigate("/workflows")}
            >
              Create workflow
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/data")}>
              Manage devices
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function Step({
  number,
  icon: Icon,
  title,
  detail,
  state,
  showConnector = false,
}: {
  number: number;
  icon: LucideIcon;
  title: string;
  detail: string;
  state: "done" | "current" | "upcoming";
  showConnector?: boolean;
}) {
  return (
    <li className="gap-detail-close grid grid-cols-[2rem_minmax(0,1fr)]">
      <div className="flex flex-col items-center">
        <span
          className={cx(
            "type-meta grid size-8 shrink-0 place-items-center rounded-full font-semibold",
            state === "done" && "bg-feedback-positive text-text-inverse",
            state === "current" && "bg-surface-inverse text-text-inverse",
            state === "upcoming" && "bg-surface-secondary text-text-secondary",
          )}
          aria-hidden="true"
        >
          {state === "done" ? <Check size={15} strokeWidth={2.75} /> : number}
        </span>
        {showConnector ? (
          <span
            className={cx(
              "w-px flex-1",
              state === "done" ? "bg-feedback-positive" : "bg-stroke-primary",
            )}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div className={cx("min-w-0 pt-0.5", showConnector && "pb-detail-close")}>
        <p
          className={cx(
            "type-body-em gap-detail-tight m-0 flex items-center",
            state === "upcoming" ? "text-text-secondary" : "text-text-primary",
          )}
        >
          <Icon
            className={cx(
              "size-4 shrink-0",
              state === "upcoming" ? "text-icon-tertiary" : "text-icon-primary",
            )}
            aria-hidden="true"
          />
          <span>
            {title}
            {state === "done" ? <span className="sr-only"> (done)</span> : null}
            {state === "current" ? <span className="sr-only"> (current)</span> : null}
          </span>
        </p>
        <p
          className={cx(
            "type-meta mt-detail-tight m-0 ml-5",
            state === "upcoming" ? "text-text-tertiary" : "text-text-secondary",
          )}
        >
          {detail}
        </p>
      </div>
    </li>
  );
}
