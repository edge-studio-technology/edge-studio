import { LinkButton } from "../components/Button";
import { Page } from "../components/Page";
import { Card } from "../components/ui/Card";
import { Pill } from "../components/ui/Pill";
import { cx } from "../lib/cx";
import {
  workflowBlockCategoryOrder,
  workflowBlockHelp,
  workflowBlockLibraryTypes,
  type WorkflowBlockHelp,
} from "../features/automation/workflow/workflowBlockHelp";
import type { AutomationBlockType } from "../features/automation/automationTypes";

const mutedText = "type-body text-text-secondary";
const sectionGridClass = "grid gap-detail-close";

export function AutomationHelpPage() {
  return (
    <Page
      title="Workflow automation guide"
      desc="Learn how to build workflows on the canvas and what each block does."
      action={
        <LinkButton href="/automation" size="sm" variant="secondary">
          Back to Automation
        </LinkButton>
      }
    >
      <Card className="border-stroke-secondary grid w-full gap-detail-close border">
        <div className={sectionGridClass}>
          <h2 className="type-title text-text-primary m-0">How the canvas works</h2>
          <p className={cx(mutedText, "m-0")}>Workflows are ordered block pipelines.</p>
          <ol className={cx(mutedText, "m-0 grid gap-detail-next pl-margin-tight")}>
            <li>
              Choose one start block first. It decides whether the workflow runs manually, on a
              schedule, or from an incoming event.
            </li>
            <li>Add data blocks to record, fetch, capture, or prepare values for later steps.</li>
            <li>
              Add logic blocks when the workflow should wait or continue only when a value matches.
            </li>
            <li>
              Add action blocks to show a preview, control an output device, send a payment, or stamp
              data.
            </li>
            <li>
              Select any block on the canvas to configure it. Validation warnings and errors appear
              on the block and in the validation panel.
            </li>
          </ol>
        </div>
      </Card>

      <div className="grid w-full gap-detail-close">
        {workflowBlockCategoryOrder.map((category) => (
          <Card key={category} className="border-stroke-secondary grid gap-detail-close border">
            <div className="gap-detail-next flex flex-wrap items-center justify-between">
              <h2 className="type-title text-text-primary m-0">{category} blocks</h2>
              <Pill tone="neutral">{workflowBlockLibraryTypes[category].length} blocks</Pill>
            </div>
            <div className="grid gap-detail-close lg:grid-cols-2">
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
    <article
      id={type}
      className="border-stroke-secondary scroll-mt-pad-distant grid gap-detail-close rounded-soft border p-margin-tight"
    >
      <header className="grid gap-detail-tight">
        <div className="gap-detail-next flex flex-wrap items-center justify-between">
          <h3 className="type-body-em text-text-primary m-0">{help.title}</h3>
          <Pill tone="neutral">{help.category}</Pill>
        </div>
        <p className={cx(mutedText, "m-0")}>{help.shortDescription}</p>
      </header>
      <HelpSection title="What it does" items={[help.whatItDoes]} />
      <HelpSection title="When to use it" items={[help.whenToUse]} />
      {help.fields.length > 0 ? <FieldReference fields={help.fields} /> : null}
      <HelpSection title="Configuration" items={help.configuration} />
      <HelpSection title="Outputs" items={help.outputs} />
      <HelpSection title="Examples" items={help.examples} />
    </article>
  );
}

function FieldReference({ fields }: { fields: WorkflowBlockHelp["fields"] }) {
  return (
    <section className="grid gap-detail-tight">
      <h4 className="type-meta text-text-secondary m-0 uppercase">Fields</h4>
      <div className="grid gap-detail-tight">
        {fields.map((field) => (
          <div key={field.label} className="border-stroke-secondary grid gap-detail-fine border-t pt-detail-tight">
            <p className="type-body-em text-text-primary m-0">
              {field.label}
              {field.required ? " (required)" : ""}
            </p>
            <p className={cx(mutedText, "m-0")}>{field.description}</p>
            {field.shownWhen ? (
              <p className={cx(mutedText, "m-0")}>Shown when: {field.shownWhen}.</p>
            ) : null}
            {field.example ? <p className={cx(mutedText, "m-0")}>Example: {field.example}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function HelpSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="grid gap-detail-tight">
      <h4 className="type-meta text-text-secondary m-0 uppercase">{title}</h4>
      <ul className={cx(mutedText, "m-0 grid gap-detail-tight pl-margin-tight")}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
