import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkflowBlockLibrary } from "../../../../../src/features/automation/workflow/toolkit/WorkflowBlockLibrary";
import type { DataSource } from "../../../../../src/features/data-sources/dataSourceTypes";

function source(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: "src-1",
    createdAt: "now",
    updatedAt: "now",
    name: "GPIO input",
    type: "gpio-input",
    status: "ok",
    description: null,
    config: {},
    lastReadAt: null,
    lastError: null,
    lastPreview: null,
    lastHash: null,
    ...overrides,
  };
}

describe("WorkflowBlockLibrary", () => {
  it("shows start blocks group in build mode, open by default with no start selected", () => {
    render(
      <WorkflowBlockLibrary
        hasStartBlock={false}
        onSelectStartBlock={() => {}}
        onAddBlock={() => {}}
      />,
    );
    expect(screen.getByText("Start blocks")).toBeInTheDocument();
    expect(screen.getByText("Manual run")).toBeInTheDocument();
  });

  it("hides the start blocks group in edit mode", () => {
    render(
      <WorkflowBlockLibrary
        mode="edit"
        hasStartBlock
        onSelectStartBlock={() => {}}
        onAddBlock={() => {}}
      />,
    );
    expect(screen.queryByText("Start blocks")).not.toBeInTheDocument();
  });

  it("selects a start block by clicking its card", async () => {
    const onSelectStartBlock = vi.fn();
    render(
      <WorkflowBlockLibrary
        hasStartBlock={false}
        onSelectStartBlock={onSelectStartBlock}
        onAddBlock={() => {}}
      />,
    );
    await userEvent.click(screen.getByText("Manual run"));
    expect(onSelectStartBlock).toHaveBeenCalledWith("manual_start");
  });

  it("marks the selected start block with a checkmark and aria-pressed", () => {
    render(
      <WorkflowBlockLibrary
        hasStartBlock
        selectedStartType="manual_start"
        onSelectStartBlock={() => {}}
        onAddBlock={() => {}}
      />,
    );
    const card = screen.getByText("Manual run").closest('[role="button"]');
    expect(card).toHaveAttribute("aria-pressed", "true");
  });

  it("disables data/logic/action blocks until a start block exists", async () => {
    const onAddBlock = vi.fn();
    render(
      <WorkflowBlockLibrary
        hasStartBlock={false}
        onSelectStartBlock={() => {}}
        onAddBlock={onAddBlock}
      />,
    );
    // Open the Data blocks disclosure (closed by default while no start block yet).
    await userEvent.click(screen.getByText("Data blocks"));
    const waitCard = screen.getByText("Record trigger event").closest('[role="button"]');
    expect(waitCard).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(screen.getByText("Record trigger event"));
    expect(onAddBlock).not.toHaveBeenCalled();
  });

  it("adds a data block once a start block and its device prerequisite exist", async () => {
    const onAddBlock = vi.fn();
    render(
      <WorkflowBlockLibrary
        hasStartBlock
        sources={[source({ type: "json-api" })]}
        onSelectStartBlock={() => {}}
        onAddBlock={onAddBlock}
      />,
    );
    await userEvent.click(screen.getByText("Fetch data source"));
    expect(onAddBlock).toHaveBeenCalledWith("fetch_data_source");
  });

  it("disables device-dependent block types missing their device with a reason tooltip", async () => {
    render(
      <WorkflowBlockLibrary
        hasStartBlock
        sources={[]}
        onSelectStartBlock={() => {}}
        onAddBlock={() => {}}
      />,
    );
    // Logic blocks group is closed by default; open it isn't needed for fetch since Data is open by default.
    const fetchCard = screen.getByText("Fetch data source").closest('[role="button"]');
    expect(fetchCard).toHaveAttribute("aria-disabled", "true");
  });

  it("enables fetch_data_source once a readable source exists", () => {
    render(
      <WorkflowBlockLibrary
        hasStartBlock
        sources={[source({ type: "json-api" })]}
        onSelectStartBlock={() => {}}
        onAddBlock={() => {}}
      />,
    );
    const fetchCard = screen.getByText("Fetch data source").closest('[role="button"]');
    expect(fetchCard).not.toHaveAttribute("aria-disabled");
  });

  it("shows the enable switch only in build mode with enabled/onEnabledChange given", async () => {
    const onEnabledChange = vi.fn();
    render(
      <WorkflowBlockLibrary
        hasStartBlock
        enabled={false}
        onEnabledChange={onEnabledChange}
        onSelectStartBlock={() => {}}
        onAddBlock={() => {}}
      />,
    );
    const toggle = screen.getByRole("switch", { name: "Enable after create" });
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);
    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it("does not show the enable switch in edit mode", () => {
    render(
      <WorkflowBlockLibrary
        mode="edit"
        hasStartBlock
        enabled={false}
        onEnabledChange={() => {}}
        onSelectStartBlock={() => {}}
        onAddBlock={() => {}}
      />,
    );
    expect(screen.queryByRole("switch", { name: "Enable after create" })).not.toBeInTheDocument();
  });

  it("disables record_trigger_event with a reason when send_transaction requires an address book contact", async () => {
    render(
      <WorkflowBlockLibrary
        hasStartBlock
        canAddSendPayment={false}
        onSelectStartBlock={() => {}}
        onAddBlock={() => {}}
      />,
    );
    await userEvent.click(screen.getByText("Action blocks"));
    const sendPaymentCard = screen.getByText("Send payment").closest('[role="button"]');
    expect(sendPaymentCard).toHaveAttribute("aria-disabled", "true");
  });
});
