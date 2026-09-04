import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AutomationInboxTable } from "../../../src/features/automation/AutomationInboxTable";
import type { AutomationInboxItem } from "../../../src/features/automation/automationTypes";

function item(overrides: Partial<AutomationInboxItem> = {}): AutomationInboxItem {
  return {
    id: "i1",
    workflowId: "w1",
    workflowName: "Front gate flow",
    runId: "r1",
    blockId: "b1",
    title: "Motion detected",
    format: "text",
    content: "Motion detected at the front gate.",
    renderedText: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    readAt: null,
    ...overrides,
  };
}

async function openInbox() {
  await userEvent.click(screen.getByText("Workflow Inbox"));
}

describe("AutomationInboxTable", () => {
  it("shows the unread count pill", async () => {
    render(
      <AutomationInboxTable
        items={[item({ readAt: null }), item({ id: "i2", readAt: "2026-08-01T00:00:00.000Z" })]}
        busy={false}
        onMarkRead={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText("1 unread")).toBeInTheDocument();
  });

  it("shows a loading state once opened", async () => {
    render(<AutomationInboxTable items={[]} busy={false} loading onMarkRead={() => {}} onDelete={() => {}} />);
    await openInbox();
    expect(screen.getByText("Fetching your inbox")).toBeInTheDocument();
  });

  it("shows an empty state with no items once opened", async () => {
    render(<AutomationInboxTable items={[]} busy={false} onMarkRead={() => {}} onDelete={() => {}} />);
    await openInbox();
    expect(screen.getByText("No preview items yet")).toBeInTheDocument();
  });

  it("renders a row per item with title, workflow, format, and read status", async () => {
    render(
      <AutomationInboxTable
        items={[item({ readAt: "2026-08-01T00:00:00.000Z" })]}
        busy={false}
        onMarkRead={() => {}}
        onDelete={() => {}}
      />,
    );
    await openInbox();

    const table = screen.getByRole("table");
    expect(within(table).getByText("Motion detected")).toBeInTheDocument();
    expect(within(table).getByText("Front gate flow")).toBeInTheDocument();
    expect(within(table).getByText("text")).toBeInTheDocument();
    expect(within(table).getByText("Read")).toBeInTheDocument();
  });

  it("filters items by title/workflow/format text", async () => {
    render(
      <AutomationInboxTable
        items={[item({ id: "i1", title: "Motion detected" }), item({ id: "i2", title: "Door opened" })]}
        busy={false}
        onMarkRead={() => {}}
        onDelete={() => {}}
      />,
    );
    await openInbox();

    await userEvent.type(screen.getByLabelText("Search"), "door");
    expect(await screen.findByText("Door opened")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Motion detected")).not.toBeInTheDocument();
    });
  });

  it("filters items by read status", async () => {
    render(
      <AutomationInboxTable
        items={[
          item({ id: "i1", title: "Unread item", readAt: null }),
          item({ id: "i2", title: "Read item", readAt: "2026-08-01T00:00:00.000Z" }),
        ]}
        busy={false}
        onMarkRead={() => {}}
        onDelete={() => {}}
      />,
    );
    await openInbox();

    await userEvent.selectOptions(screen.getByLabelText("Filter"), "unread");
    expect(screen.getByText("Unread item")).toBeInTheDocument();
    expect(screen.queryByText("Read item")).not.toBeInTheDocument();
  });

  it("shows a no-matching state and clears filters from it", async () => {
    render(
      <AutomationInboxTable items={[item()]} busy={false} onMarkRead={() => {}} onDelete={() => {}} />,
    );
    await openInbox();

    await userEvent.type(screen.getByLabelText("Search"), "nomatch");
    expect(await screen.findByText("No matching previews")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Motion detected")).toBeInTheDocument();
  });

  it("opens the details modal and marks unread items read on view", async () => {
    const onMarkRead = vi.fn();
    render(
      <AutomationInboxTable items={[item()]} busy={false} onMarkRead={onMarkRead} onDelete={() => {}} />,
    );
    await openInbox();

    await userEvent.click(screen.getByRole("button", { name: "View preview for Motion detected" }));
    expect(onMarkRead).toHaveBeenCalledWith(item(), true);

    const dialog = screen.getByRole("dialog", { name: "Motion detected" });
    expect(within(dialog).getByText("Front gate flow")).toBeInTheDocument();
  });

  it("does not mark an already-read item read again on view", async () => {
    const onMarkRead = vi.fn();
    render(
      <AutomationInboxTable
        items={[item({ readAt: "2026-08-01T00:00:00.000Z" })]}
        busy={false}
        onMarkRead={onMarkRead}
        onDelete={() => {}}
      />,
    );
    await openInbox();

    await userEvent.click(screen.getByRole("button", { name: "View preview for Motion detected" }));
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it("renders link and image preview content in the details modal", async () => {
    render(
      <AutomationInboxTable
        items={[item({ format: "link", content: "https://integritas.technology" })]}
        busy={false}
        onMarkRead={() => {}}
        onDelete={() => {}}
      />,
    );
    await openInbox();
    await userEvent.click(screen.getByRole("button", { name: "View preview for Motion detected" }));

    const link = screen.getByRole("link", { name: "https://integritas.technology" });
    expect(link).toHaveAttribute("href", "https://integritas.technology");
  });

  it("marks unread/read and deletes via the row menu", async () => {
    const onMarkRead = vi.fn();
    const onDelete = vi.fn();
    render(
      <AutomationInboxTable
        items={[item({ readAt: "2026-08-01T00:00:00.000Z" })]}
        busy={false}
        onMarkRead={onMarkRead}
        onDelete={onDelete}
      />,
    );
    await openInbox();

    await userEvent.click(screen.getByRole("button", { name: "More actions for Motion detected" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Mark unread" }));
    expect(onMarkRead).toHaveBeenCalledWith(item({ readAt: "2026-08-01T00:00:00.000Z" }), false);

    await userEvent.click(screen.getByRole("button", { name: "More actions for Motion detected" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(item({ readAt: "2026-08-01T00:00:00.000Z" }));
  });
});
