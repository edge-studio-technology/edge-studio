import { useLayoutEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LinkButton } from "../components/Button";
import { Page } from "../components/Page";
import { Card } from "../components/ui/Card";
import { Disclosure } from "../components/ui/Disclosure";
import { Divider } from "../components/ui/Divider";
import { Pill } from "../components/ui/Pill";
import { TabList } from "../components/ui/TabList";
import { cx } from "../lib/cx";
import {
  workflowBlockCategoryOrder,
  workflowBlockHelp,
  workflowBlockLibraryTypes,
  type WorkflowBlockCategory,
  type WorkflowBlockHelp,
} from "../features/automation/workflow/workflowBlockHelp";
import type { AutomationBlockType } from "../features/automation/automationTypes";

const body = "type-body text-text-primary m-0 [line-height:1.5]";
const bodyMuted = "type-body text-text-secondary m-0 [line-height:1.5]";
const heading = "type-callout text-text-primary m-0";
const label = "type-body-em text-text-primary m-0";
const guideCardClass = "border-stroke-secondary grid w-full gap-detail-close border";

const categoryTabOptions = workflowBlockCategoryOrder.map((value) => ({
  value,
  label: value,
}));

function isBlockType(value: string): value is AutomationBlockType {
  return value in workflowBlockHelp;
}

function categoryFromHash(hash: string): WorkflowBlockCategory | null {
  const id = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!isBlockType(id)) return null;
  return workflowBlockHelp[id].category;
}

const workflowSteps = [
  "Choose one start block to decide how the workflow runs.",
  "Add data blocks to record, fetch, capture, or prepare values for later steps.",
  "Add logic blocks when the workflow should wait or continue only when a value matches.",
  "Add action blocks to show a preview, control an output device, send a payment, or stamp data.",
  "Select any block on the canvas to configure it. Validation warnings and errors appear on the block and in the validation panel.",
];

export function AutomationHelpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [category, setCategory] = useState<WorkflowBlockCategory>(
    () => categoryFromHash(window.location.hash) ?? "Start",
  );

  useLayoutEffect(() => {
    const fromHash = categoryFromHash(location.hash);
    if (fromHash) setCategory(fromHash);
  }, [location.hash]);

  useLayoutEffect(() => {
    const id = location.hash.slice(1);
    if (!isBlockType(id) || workflowBlockHelp[id].category !== category) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [category, location.hash]);

  function handleCategoryChange(next: WorkflowBlockCategory) {
    setCategory(next);
    const id = location.hash.slice(1);
    if (isBlockType(id) && workflowBlockHelp[id].category !== next) {
      navigate({ pathname: location.pathname, search: location.search }, { replace: true });
    }
  }

  return (
    <Page
      title="Workflow guide"
      desc="Learn how to build workflows on the canvas and what each block does."
      action={
        <LinkButton href="/workflows" iconStart={<ArrowLeft size={16} />}>
          Back to workflows
        </LinkButton>
      }
    >
      <Card className={guideCardClass}>
        <div className="gap-detail-tight grid">
          <h2 className={heading}>How to use the canvas</h2>
          <p className={bodyMuted}>
            Blocks run in order from start to finish. Use the canvas to see the whole workflow, then
            select a block to edit it and read its help in the configure panel.
          </p>
        </div>
        <Divider />
        <ol className="gap-detail-close m-0 grid list-none p-0">
          {workflowSteps.map((step, index) => (
            <li key={step} className="gap-detail-close grid grid-cols-[1.25rem_minmax(0,1fr)]">
              <span className={cx(label, "text-text-tertiary tabular-nums")}>{index + 1}</span>
              <p className={body}>{step}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card className={guideCardClass}>
        <TabList
          label="Block categories"
          value={category}
          options={categoryTabOptions}
          onChange={handleCategoryChange}
          className="flex flex-wrap"
        />
        <div className="gap-detail-tight grid">
          <h2 className={heading}>{category} blocks</h2>
          <p className={bodyMuted}>{categoryDescription(category)}</p>
        </div>
        <div className="border-stroke-secondary rounded-soft divide-y divide-stroke-secondary border">
          {workflowBlockLibraryTypes[category].map((type) => (
            <BlockReference
              key={type}
              type={type}
              help={workflowBlockHelp[type]}
              openFromHash={location.hash.slice(1) === type}
            />
          ))}
        </div>
      </Card>
    </Page>
  );
}

function BlockReference({
  type,
  help,
  openFromHash,
}: {
  type: AutomationBlockType;
  help: WorkflowBlockHelp;
  openFromHash: boolean;
}) {
  const [open, setOpen] = useState(openFromHash);

  useLayoutEffect(() => {
    if (openFromHash) setOpen(true);
  }, [openFromHash]);

  return (
    <article id={type} className="scroll-mt-pad-distant p-pad-tight">
      <Disclosure
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        summaryClassName="items-start [&>span:first-child]:min-w-0 [&>span:first-child]:flex-1"
        contentClassName="gap-detail-close pt-detail-close"
        title={
          <span className="gap-detail-tight grid min-w-0 flex-1 text-left">
            <h3 className={heading}>{help.title}</h3>
            <p className={bodyMuted}>{help.shortDescription}</p>
          </span>
        }
      >
        <HelpBlock title="What it does">{help.whatItDoes}</HelpBlock>
        <HelpBlock title="When to use it">{help.whenToUse}</HelpBlock>
        {help.fields.length > 0 ? <FieldReference fields={help.fields} /> : null}
        <HelpList title="Outputs" items={help.outputs} />
        <HelpList title="Examples" items={help.examples} />
      </Disclosure>
    </article>
  );
}

function categoryDescription(category: string) {
  if (category === "Start") return "Choose how a workflow begins.";
  if (category === "Data") return "Create, capture, or prepare data for later blocks.";
  if (category === "Logic") return "Control whether and when later blocks run.";
  if (category === "Action") return "Send visible output, hardware commands, or wallet actions.";
  return "Optional blocks attached to data-producing blocks.";
}

function HelpBlock({ title, children }: { title: string; children: string }) {
  return (
    <section className="gap-detail-tight grid">
      <h4 className={label}>{title}</h4>
      <p className={body}>{children}</p>
    </section>
  );
}

function FieldReference({ fields }: { fields: WorkflowBlockHelp["fields"] }) {
  return (
    <section className="gap-detail-close grid">
      <h4 className={label}>Fields</h4>
      <div className="gap-detail-close grid">
        {fields.map((field) => (
          <div key={field.label} className="gap-detail-tight grid">
            <div className="gap-detail-tight flex flex-wrap items-center">
              <p className={label}>{field.label}</p>
              {field.required ? <Pill tone="warn">Required</Pill> : null}
            </div>
            <p className={bodyMuted}>{field.description}</p>
            {field.shownWhen ? <p className={bodyMuted}>Shown when: {field.shownWhen}.</p> : null}
            {field.example ? (
              <p className={bodyMuted}>
                Example: <code>{field.example}</code>
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function HelpList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="gap-detail-tight grid">
      <h4 className={label}>{title}</h4>
      <ul className="gap-detail-next m-0 grid list-none p-0">
        {items.map((item) => (
          <li key={item} className={body}>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
