import { useState, type ReactNode } from "react";
import { normalizeError } from "../../lib/errors";
import { cx } from "../../lib/cx";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { ScrollArea } from "../ui/ScrollArea";

function DetailField({
  label,
  children,
  emphasis = false,
}: {
  label: string;
  children: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <section className="gap-detail-tight flex w-full flex-col">
      <p className="type-meta text-text-tertiary m-0">{label}</p>
      <div
        className={cx(
          "m-0 w-full break-words",
          emphasis ? "type-body-em text-text-primary" : "type-body text-text-primary",
        )}
      >
        {children}
      </div>
    </section>
  );
}

function CodeBlock({ label, value }: { label: string; value: string }) {
  return (
    <section className="gap-detail-tight flex w-full flex-col">
      <p className="type-meta text-text-tertiary m-0">{label}</p>
      <ScrollArea className="border-stroke-secondary bg-surface-inverse rounded-soft p-pad-close max-h-40 w-full border">
        <pre className="type-mono text-text-inverse m-0 [overflow-wrap:anywhere] whitespace-pre-wrap">
          {value}
        </pre>
      </ScrollArea>
    </section>
  );
}

/** Trigger + dialog for inspecting a normalized operational error. */
export function ErrorDetails({
  error,
  label = "View details",
  className,
}: {
  error: unknown;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const normalized = normalizeError(error);

  const contextLines = [
    `Domain: ${normalized.domain}`,
    `Error type: ${normalized.type}`,
    normalized.nativeCode ? `Native code: ${normalized.nativeCode}` : null,
    normalized.occurredAt ? `Time: ${normalized.occurredAt}` : null,
  ].filter(Boolean) as string[];

  return (
    <>
      <button
        type="button"
        className={cx(
          "type-link text-text-accent hover:text-text-accent-hover transition-colors duration-200",
          "cursor-pointer border-0 bg-transparent p-0",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open ? (
        <Modal
          title="Error details"
          className="max-w-[600px]"
          onClose={() => setOpen(false)}
          footer={
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          }
        >
          <div className="gap-detail-near px-detail-next py-pad-close flex flex-col">
            <DetailField label="Type" emphasis>
              {normalized.title}
            </DetailField>
            <DetailField label="Message">{normalized.message}</DetailField>
            {normalized.nativeMessage && normalized.nativeMessage !== normalized.message ? (
              <DetailField label="Native details">{normalized.nativeMessage}</DetailField>
            ) : null}
            {contextLines.length > 0 ? (
              <DetailField label="Context">
                <div className="gap-detail-tight flex flex-col">
                  {contextLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              </DetailField>
            ) : null}
            {normalized.context ? (
              <CodeBlock
                label="Additional context"
                value={JSON.stringify(normalized.context, null, 2)}
              />
            ) : null}
            <CodeBlock label="Raw" value={JSON.stringify(normalized.raw, null, 2)} />
          </div>
        </Modal>
      ) : null}
    </>
  );
}
