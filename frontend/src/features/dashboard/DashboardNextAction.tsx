import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { APP_NAME } from "../../app/names";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { listAutomationWorkflows } from "../automation/automationApi";
import { listDataSources } from "../data-sources/dataSourcesApi";
import { cx } from "../../lib/cx";

export function DashboardNextAction() {
  const navigate = useNavigate();
  const [deviceCount, setDeviceCount] = useState<number | null>(null);
  const [workflowCount, setWorkflowCount] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      listDataSources()
        .then((res) => res.items.length)
        .catch(() => 0),
      listAutomationWorkflows()
        .then((res) => res.items.filter((workflow) => !workflow.archived).length)
        .catch(() => 0),
    ]).then(([devices, workflows]) => {
      setDeviceCount(devices);
      setWorkflowCount(workflows);
    });
  }, []);

  if (deviceCount === null || workflowCount === null) return null;

  const hasDevices = deviceCount > 0;
  const hasWorkflows = workflowCount > 0;
  if (hasDevices && hasWorkflows) return null;

  const step = hasDevices ? 2 : 1;

  return (
    <Card className="gap-detail-near flex w-full flex-col">
      <header className="gap-detail-next flex max-w-2xl flex-col">
        <h2 className="type-title text-text-primary m-0">
          {step === 1 ? "Connect a device to get started" : "Create your first workflow"}
        </h2>
        <p className="type-body text-text-secondary m-0">
          {APP_NAME} connects device data, proves it with Integritas, runs automations, and settles
          value on Minima. Do this in order:
        </p>
      </header>

      <ol className="m-0 grid max-w-xl list-none gap-0 p-0">
        <Step
          number={1}
          title="Connect devices"
          detail="Add a sensor, API, webhook, MQTT, or GPIO source."
          state={hasDevices ? "done" : "current"}
          showConnector
        />
        <Step
          number={2}
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
              iconEnd={<ArrowRight aria-hidden="true" />}
              onClick={() => navigate("/automation")}
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
  title,
  detail,
  state,
  showConnector = false,
}: {
  number: number;
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
            "type-body-em m-0",
            state === "upcoming" ? "text-text-secondary" : "text-text-primary",
          )}
        >
          {title}
          {state === "done" ? <span className="sr-only"> (done)</span> : null}
          {state === "current" ? <span className="sr-only"> (current)</span> : null}
        </p>
        <p
          className={cx(
            "type-meta m-0 mt-detail-tight",
            state === "upcoming" ? "text-text-tertiary" : "text-text-secondary",
          )}
        >
          {detail}
        </p>
      </div>
    </li>
  );
}
