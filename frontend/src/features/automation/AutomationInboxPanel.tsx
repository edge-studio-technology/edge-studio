import { useState } from "react";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { cx } from "../../lib/cx";
import { formatLocalTime } from "../../lib/time";
import type { AutomationInboxItem } from "./automationTypes";
import { isImagePreviewContent, textPreviewContent } from "./workflow/workflowHelpers";
import {
  StatusPill,
  cardClass,
  mutedText,
  softCardClass,
  statusRowClass,
} from "./workflow/workflowWorkspaceUi";

/** Feature-wide Automation inbox (Show preview outputs). Not the workflow editor. */
export function AutomationInboxPanel({
  items,
  busy,
  onMarkRead,
  onDelete,
}: {
  items: AutomationInboxItem[];
  busy: boolean;
  onMarkRead: (item: AutomationInboxItem, read: boolean) => void;
  onDelete: (item: AutomationInboxItem) => void;
}) {
  return (
    <section className={cx(cardClass, "grid gap-4")}>
      <div className={statusRowClass}>
        <div>
          <strong>Automation inbox</strong>
          <p className={mutedText}>
            Local workflow previews stay here even if no browser was open when the workflow ran.
          </p>
        </div>
        <StatusPill status={items.some((item) => !item.readAt) ? "warn" : "neutral"}>
          {items.filter((item) => !item.readAt).length} unread
        </StatusPill>
      </div>
      {items.length === 0 && (
        <p className={mutedText}>No preview items yet. Add a Show preview block to a workflow.</p>
      )}
      <div className="grid gap-3">
        {items.map((item) => (
          <article key={item.id} className={cx(softCardClass, "grid gap-3")}>
            <div className={statusRowClass}>
              <div>
                <strong>{item.title}</strong>
                <p className={mutedText}>
                  {item.workflowName} · {item.format} · {formatLocalTime(item.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => onMarkRead(item, !item.readAt)}
                >
                  {item.readAt ? "Mark unread" : "Mark read"}
                </Button>
                <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => onDelete(item)}>
                  Delete
                </Button>
              </div>
            </div>
            <InboxPreview item={item} />
          </article>
        ))}
      </div>
    </section>
  );
}

function InboxPreview({ item }: { item: AutomationInboxItem }) {
  return <InboxPreviewModal item={item} />;
}

function InboxPreviewModal({ item }: { item: AutomationInboxItem }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="border-0 bg-transparent p-0 text-left font-extrabold text-blue-600 underline"
        onClick={() => setOpen(true)}
      >
        View preview
      </button>
      {open && (
        <Modal title={item.title} onClose={() => setOpen(false)}>
          <InboxPreviewContent item={item} />
        </Modal>
      )}
    </>
  );
}

function InboxPreviewContent({ item }: { item: AutomationInboxItem }) {
  if (item.format === "json") {
    return (
      <pre className="m-0 overflow-visible whitespace-pre-wrap rounded-2xl bg-slate-900 p-3.5 text-[0.84rem] text-blue-100 [overflow-wrap:anywhere]">
        {JSON.stringify(item.content, null, 2)}
      </pre>
    );
  }
  if (item.format === "link" && typeof item.content === "string") {
    return (
      <a className="font-bold text-blue-700 underline" href={item.content} target="_blank" rel="noreferrer">
        {item.content}
      </a>
    );
  }
  if (item.format === "image" && isImagePreviewContent(item.content)) {
    const src =
      item.content.source === "local_path"
        ? `/api/automation/inbox/${item.id}/image`
        : item.content.value;
    return (
      <div className="grid gap-3">
        <img
          className="max-h-[72vh] max-w-full rounded-2xl border border-slate-200 object-contain"
          src={src}
          alt={item.title}
        />
        <small className={mutedText}>
          {item.content.source}: {item.content.value}
        </small>
      </div>
    );
  }
  return <p className="whitespace-pre-wrap text-sm text-slate-700">{textPreviewContent(item)}</p>;
}
