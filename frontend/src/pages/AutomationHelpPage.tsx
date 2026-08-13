import { ArrowLeft, CheckCircle2, Layers3 } from "lucide-react";
import { LinkButton } from "../components/Button";
import { Page } from "../components/Page";
import { Card } from "../components/ui/Card";
import { Pill } from "../components/ui/Pill";
import { Text } from "../components/ui/Text";
import { cx } from "../lib/cx";
import {
  workflowBlockCategoryOrder,
  workflowBlockHelp,
  workflowBlockLibraryTypes,
  type WorkflowBlockHelp,
} from "../features/automation/workflow/workflowBlockHelp";
import type { AutomationBlockType } from "../features/automation/automationTypes";

const mutedText = "type-body text-text-secondary";
const guideCardClass = "border-stroke-secondary grid w-full gap-detail-close border";
const blockCardClass =
  "border-stroke-secondary scroll-mt-pad-distant grid gap-detail-close rounded-soft border bg-surface-always-white p-margin-tight shadow-sm";
const sectionTitleClass = "type-meta text-text-secondary m-0 uppercase";

const workflowSteps = [
  "Choose one start block first. It decides whether the workflow runs manually, on a schedule, or from an incoming event.",
  "Add data blocks to record, fetch, capture, or prepare values for later steps.",
  "Add logic blocks when the workflow should wait or continue only when a value matches.",
  "Add action blocks to show a preview, control an output device, send a payment, or stamp data.",
  "Select any block on the canvas to configure it. Validation warnings and errors appear on the block and in the validation panel.",
];

export function AutomationHelpPage() {
  return (
    <Page
      title="Workflow automation guide"
      desc="Learn how to build workflows on the canvas and what each block does."
      action={
        <LinkButton href="/automation" iconStart={<ArrowLeft size={16} />}>
          Back to workflows
        </LinkButton>
      }
    >
      <Card className={cx(guideCardClass, "bg-surface-primary")}>
        <div className="gap-detail-next flex items-start">
          <span className="bg-surface-always-white border-stroke-secondary grid size-10 shrink-0 place-items-center rounded-full border">
            <Layers3 aria-hidden className="text-icon-primary size-5" />
          </span>
          <div className="gap-detail-tight grid">
            <Text.Title>How the canvas works</Text.Title>
            <Text.Body className="text-text-secondary">
              Workflows are ordered block pipelines. The canvas is for scanning configured behavior;
              the configure panel is for editing and block-specific help.
            </Text.Body>
          </div>
        </div>
        <ol className="gap-detail-next m-0 grid list-none p-0 md:grid-cols-2 xl:grid-cols-5">
          {workflowSteps.map((step, index) => (
            <li
              key={step}
              className="border-stroke-secondary bg-surface-always-white gap-detail-tight rounded-soft p-margin-close grid border"
            >
              <span className="bg-surface-secondary text-text-primary type-meta grid size-7 place-items-center rounded-full">
                {index + 1}
              </span>
              <Text.Body className="text-text-secondary">{step}</Text.Body>
            </li>
          ))}
        </ol>
      </Card>

      <div className="gap-detail-close grid w-full">
        {workflowBlockCategoryOrder.map((category) => (
          <Card key={category} className={guideCardClass}>
            <div className="gap-detail-next flex flex-wrap items-center justify-between">
              <div className="gap-detail-tight grid">
                <h2 className="type-title text-text-primary m-0">{category} blocks</h2>
                <p className={cx(mutedText, "m-0")}>{categoryDescription(category)}</p>
              </div>
              <Pill tone="neutral">{workflowBlockLibraryTypes[category].length} blocks</Pill>
            </div>
            <div className="gap-detail-close grid xl:grid-cols-2">
              {workflowBlockLibraryTypes[category].map((type) => (
                <BlockReference key={type} type={type} help={workflowBlockHelp[type]} />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}

function BlockReference({ type, help }: { type: AutomationBlockType; help: WorkflowBlockHelp }) {
  return (
    <article id={type} className={blockCardClass}>
      <header className="gap-detail-tight grid">
        <div className="gap-detail-next flex flex-wrap items-center justify-between">
          <h3 className="type-callout text-text-primary m-0">{help.title}</h3>
          <Pill tone="neutral">{help.category}</Pill>
        </div>
        <Text.Body className="text-text-secondary">{help.shortDescription}</Text.Body>
      </header>
      <div className="gap-detail-next grid sm:grid-cols-2">
        <InfoPanel title="What it does">{help.whatItDoes}</InfoPanel>
        <InfoPanel title="When to use it">{help.whenToUse}</InfoPanel>
      </div>
      {help.fields.length > 0 ? <FieldReference fields={help.fields} /> : null}
      <div className="gap-detail-next grid sm:grid-cols-2">
        <HelpSection title="Outputs" items={help.outputs} />
        <HelpSection title="Examples" items={help.examples} />
      </div>
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

function InfoPanel({ title, children }: { title: string; children: string }) {
  return (
    <section className="bg-surface-secondary gap-detail-tight rounded-soft p-margin-close grid">
      <h4 className={sectionTitleClass}>{title}</h4>
      <Text.Body className="text-text-secondary">{children}</Text.Body>
    </section>
  );
}

function FieldReference({ fields }: { fields: WorkflowBlockHelp["fields"] }) {
  return (
    <section className="gap-detail-tight grid">
      <h4 className={sectionTitleClass}>Fields</h4>
      <div className="gap-detail-tight grid sm:grid-cols-2">
        {fields.map((field) => (
          <div
            key={field.label}
            className="border-stroke-secondary bg-surface-primary gap-detail-tight rounded-soft p-margin-close grid border"
          >
            <div className="gap-detail-tight flex flex-wrap items-center">
              <p className="type-body-em text-text-primary m-0">{field.label}</p>
              {field.required ? <Pill tone="warn">Required</Pill> : null}
            </div>
            <p className={cx(mutedText, "m-0")}>{field.description}</p>
            {field.shownWhen ? (
              <p className="type-meta text-text-secondary m-0">Shown when: {field.shownWhen}.</p>
            ) : null}
            {field.example ? (
              <p className="type-meta text-text-secondary m-0">
                Example: <code>{field.example}</code>
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function HelpSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="gap-detail-tight grid">
      <h4 className={sectionTitleClass}>{title}</h4>
      <ul className="gap-detail-tight m-0 grid list-none p-0">
        {items.map((item) => (
          <li key={item} className="gap-detail-tight flex items-start">
            <CheckCircle2 aria-hidden className="text-icon-success mt-[2px] size-4 shrink-0" />
            <span className={mutedText}>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
