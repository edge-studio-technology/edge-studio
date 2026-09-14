import { createRef } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AttachedStampSettings,
  DraftBlockInspector,
  PersistedBlockInspector,
  type PersistedBlockInspectorHandle,
} from "../../../../src/features/automation/workflow/WorkflowBlockInspectors";
import type {
  AutomationBlock,
  AutomationBlockType,
} from "../../../../src/features/automation/automationTypes";
import type { DraftWorkflowBlock } from "../../../../src/features/automation/workflow/canvas";
import type { AddressBookEntry } from "../../../../src/features/address-book/addressBookTypes";
import type { DataSource } from "../../../../src/features/data-sources/dataSourceTypes";
import type { WalletStatus } from "../../../../src/features/wallet/walletTypes";

function draftBlock(
  type: AutomationBlockType,
  config: AutomationBlock["config"] = {},
  overrides: Partial<DraftWorkflowBlock> = {},
): DraftWorkflowBlock {
  return { id: `${type}-1`, type, config, ...overrides };
}

function source(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: "s1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    name: "Source",
    type: "json-api",
    status: "ok",
    description: null,
    config: {},
    lastReadAt: null,
    lastError: null,
    lastPreview: null,
    lastHash: null,
    ...overrides,
  } as DataSource;
}

function addressBookEntry(overrides: Partial<AddressBookEntry> = {}): AddressBookEntry {
  return {
    id: "a1",
    label: "Alice",
    address: "Mx1",
    notes: null,
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function walletStatus(overrides: Partial<WalletStatus> = {}): WalletStatus {
  return {
    checkedAt: "2026-08-01T00:00:00.000Z",
    tokens: [
      { tokenId: "0x00", name: "Minima", confirmed: "10", unconfirmed: "10", sendable: "10", isNative: true },
    ],
    ...overrides,
  };
}

function renderInspector(
  block: DraftWorkflowBlock,
  props: Partial<React.ComponentProps<typeof DraftBlockInspector>> = {},
) {
  return render(
    <DraftBlockInspector
      block={block}
      sources={[]}
      addressBook={[]}
      walletStatus={null}
      onChange={vi.fn()}
      onAttachedChange={vi.fn()}
      onAttachedRemove={vi.fn()}
      {...props}
    />,
  );
}

describe("DraftBlockInspector start blocks", () => {
  it("shows an interval select for a schedule start and reports interval changes", async () => {
    const onChange = vi.fn();
    renderInspector(draftBlock("schedule_start", { intervalSeconds: 60 }), { onChange });
    const select = screen.getByRole("combobox", { name: "Interval" });
    expect(select).toHaveValue("60");
    await userEvent.selectOptions(select, "300");
    expect(onChange).toHaveBeenCalledWith({ intervalSeconds: 300 });
  });

  it("shows a plain message for a manual start with no controls", () => {
    renderInspector(draftBlock("manual_start"));
    expect(
      screen.getByText("Manual workflows run only when you click Run now."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows a source select, cooldown, and active-only checkbox for a GPIO event start", async () => {
    const onChange = vi.fn();
    const gpioSource = source({ id: "gpio1", type: "gpio-input", config: { pin: 4 } });
    renderInspector(draftBlock("gpio_event_start", { cooldownSeconds: 0 }), {
      onChange,
      sources: [gpioSource],
    });

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Start source" }),
      "gpio1",
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: "gpio1" }),
    );

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Only run when the GPIO event is active" }),
    );
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ activeOnly: true }));
  });

  it("defaults active-only and a 60s cooldown when selecting a PIR-motion GPIO source", async () => {
    const onChange = vi.fn();
    const pirSource = source({
      id: "pir1",
      type: "gpio-input",
      config: { pin: 4, profile: "pir-motion" },
    });
    renderInspector(draftBlock("gpio_event_start", {}), { onChange, sources: [pirSource] });

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Start source" }), "pir1");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: "pir1", activeOnly: true, cooldownSeconds: 60 }),
    );
  });
});

describe("DraftBlockInspector fetch_data_source", () => {
  it("lists readable sources and reports selection", async () => {
    const onChange = vi.fn();
    const httpSource = source({ id: "http1", type: "json-api" });
    const webhookSource = source({ id: "hook1", type: "webhook" });
    renderInspector(draftBlock("fetch_data_source"), {
      onChange,
      sources: [httpSource, webhookSource],
    });

    const select = screen.getByRole("combobox", { name: "Readable source" });
    expect(within(select).getByRole("option", { name: /Source/ })).toBeInTheDocument();
    await userEvent.selectOptions(select, "http1");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sourceId: "http1" }));
  });

  it("does not render Stamp data when no stamp is attached", () => {
    renderInspector(draftBlock("fetch_data_source"));
    expect(screen.queryByText("Stamp data")).not.toBeInTheDocument();
  });
});

describe("DraftBlockInspector capture_camera", () => {
  it("shows a fixed warmup message for a photo camera", () => {
    const camera = source({ id: "cam1", type: "pi-camera", config: { mode: "photo" } });
    renderInspector(draftBlock("capture_camera", { sourceId: "cam1" }), { sources: [camera] });
    expect(
      screen.getByText("Photo captures use the camera device warmup timeout configured on Devices."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Capture duration ms" })).not.toBeInTheDocument();
  });

  it("shows a duration field for a video camera", () => {
    const camera = source({
      id: "cam1",
      type: "pi-camera",
      config: { mode: "video", durationMs: 8000 },
    });
    renderInspector(draftBlock("capture_camera", { sourceId: "cam1" }), { sources: [camera] });
    expect(screen.getByRole("textbox", { name: "Capture duration ms" })).toHaveValue("8000");
  });
});

describe("DraftBlockInspector set_variable", () => {
  it("shows a custom JSON textarea by default and reports variable name changes", async () => {
    const onChange = vi.fn();
    renderInspector(draftBlock("set_variable", { variableName: "message" }), { onChange });
    expect(screen.getByRole("textbox", { name: "Custom JSON" })).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: "Variable name" }), "x");
    expect(onChange).toHaveBeenCalled();
  });

  it("swaps to a field-path input for trigger_field source", async () => {
    const onChange = vi.fn();
    renderInspector(draftBlock("set_variable", { variableSource: "trigger_field" }), { onChange });
    expect(screen.getByRole("textbox", { name: "Field path" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Custom JSON" })).not.toBeInTheDocument();
  });
});

describe("DraftBlockInspector if_payload_field_equals", () => {
  it("defaults to a trigger field-path input and hides compare value for 'exists'", async () => {
    const onChange = vi.fn();
    renderInspector(
      draftBlock("if_payload_field_equals", { source: "trigger", operator: "equals" }),
      { onChange },
    );
    expect(screen.getByRole("textbox", { name: "Field path" })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Operator" }), "exists");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ operator: "exists" }),
    );
  });

  it("swaps to a variable-name input when the condition source is variable", async () => {
    renderInspector(draftBlock("if_payload_field_equals", { source: "variable" }));
    expect(screen.getByRole("textbox", { name: "Variable name" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Field path" })).not.toBeInTheDocument();
  });
});

describe("DraftBlockInspector wait", () => {
  it("reports duration changes", async () => {
    const onChange = vi.fn();
    renderInspector(draftBlock("wait", { durationMs: 1000 }), { onChange });
    const field = screen.getByRole("textbox", { name: "Wait duration ms" });
    expect(field).toHaveValue("1000");
    fireEvent.change(field, { target: { value: "5" } });
    expect(onChange).toHaveBeenCalledWith({ durationMs: 5 });
  });
});

describe("DraftBlockInspector show_preview", () => {
  it("shows a content textarea for the default text/custom combination", () => {
    renderInspector(draftBlock("show_preview"));
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Workflow preview");
    expect(screen.getByRole("textbox", { name: "Content" })).toBeInTheDocument();
  });

  it("shows an image-source select once the format is image", async () => {
    renderInspector(draftBlock("show_preview", { previewFormat: "image" }));
    expect(screen.getByRole("combobox", { name: "Image source" })).toBeInTheDocument();
  });

  it("hides the content textarea when the content source isn't custom", async () => {
    const onChange = vi.fn();
    renderInspector(draftBlock("show_preview"), { onChange });
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Content source" }),
      "workflow_context",
    );
    expect(onChange).toHaveBeenCalled();
  });
});

describe("DraftBlockInspector control_output", () => {
  it("shows a pulse duration and wiring hint for a GPIO output target", async () => {
    const onChange = vi.fn();
    const gpioOut = source({ id: "led1", type: "gpio-output", config: { activeState: "high" } });
    renderInspector(draftBlock("control_output"), { onChange, sources: [gpioOut] });

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Output target" }),
      "led1",
    );
    expect(onChange).toHaveBeenCalled();
  });

  it("shows a body-mode select and custom JSON textarea for an HTTP output target", async () => {
    const httpOut = source({ id: "http1", type: "http-output" });
    renderInspector(
      draftBlock("control_output", { targetId: "http1", bodyMode: "custom" }),
      { sources: [httpOut] },
    );
    expect(screen.getByRole("combobox", { name: "Request body" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Custom JSON" })).toBeInTheDocument();
  });

  it("shows multipart fields when the body mode is multipart_media", () => {
    const httpOut = source({ id: "http1", type: "http-output" });
    renderInspector(
      draftBlock("control_output", { targetId: "http1", bodyMode: "multipart_media" }),
      { sources: [httpOut] },
    );
    expect(screen.getByRole("textbox", { name: "File field name" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "JSON field name" })).toBeInTheDocument();
  });

  it("shows a message-payload label and no multipart option for an MQTT output target", () => {
    const mqttOut = source({ id: "mqtt1", type: "mqtt-output" });
    renderInspector(
      draftBlock("control_output", { targetId: "mqtt1", bodyMode: "custom" }),
      { sources: [mqttOut] },
    );
    expect(screen.getByRole("combobox", { name: "Message payload" })).toBeInTheDocument();
    const options = screen
      .getByRole("combobox", { name: "Message payload" })
      .querySelectorAll("option");
    expect(Array.from(options).some((option) => option.textContent === "Multipart media upload")).toBe(
      false,
    );
  });

  it("shows a fallback message when no output target is selected", () => {
    renderInspector(draftBlock("control_output"));
    expect(screen.getByText("Choose a configured output target from Devices.")).toBeInTheDocument();
  });
});

describe("DraftBlockInspector send_transaction", () => {
  it("shows a required-contact message and a disabled recipient select with no address book", () => {
    renderInspector(draftBlock("send_transaction"));
    expect(
      screen.getByText("You need to create an address book contact first."),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Address book recipient" })).toBeDisabled();
  });

  it("shows the sendable native balance and reports amount changes", async () => {
    const onChange = vi.fn();
    renderInspector(draftBlock("send_transaction", { recipientAddressBookId: "a1" }), {
      onChange,
      addressBook: [addressBookEntry()],
      walletStatus: walletStatus(),
    });
    expect(screen.getByText("Minima (native) - 10 sendable")).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "5");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows field errors after Done is clicked on an incomplete payment", () => {
    renderInspector(draftBlock("send_transaction"), {
      addressBook: [addressBookEntry()],
      revealSendPaymentErrors: true,
    });
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });
});

describe("DraftBlockInspector generic data block and fallback", () => {
  it("shows a generic Data section for record_trigger_event", () => {
    renderInspector(draftBlock("record_trigger_event"));
    expect(screen.getByText("Data")).toBeInTheDocument();
  });

  it("falls back to a bare Configuration section for an unhandled block type", () => {
    renderInspector(draftBlock("stamp_integritas"));
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

describe("AttachedStampSettings", () => {
  function renderAttached(
    block: DraftWorkflowBlock,
    props: Partial<React.ComponentProps<typeof AttachedStampSettings>> = {},
  ) {
    return render(
      <AttachedStampSettings
        block={block}
        onAttachedChange={vi.fn()}
        onAttachedRemove={vi.fn()}
        {...props}
      />,
    );
  }

  it("renders nothing when no stamp is attached", () => {
    const { container } = renderAttached(draftBlock("fetch_data_source"));
    expect(container).toBeEmptyDOMElement();
  });

  it("adds a default condition when the switch is toggled on", async () => {
    const onAttachedChange = vi.fn();
    const block = draftBlock("fetch_data_source", {}, {
      attachedBlocks: [draftBlock("stamp_integritas", {}, { id: "stamp1" })],
    });
    renderAttached(block, { onAttachedChange });

    await userEvent.click(
      screen.getByRole("switch", { name: "Only stamp when data matches" }),
    );
    expect(onAttachedChange).toHaveBeenCalledWith(
      "stamp1",
      expect.objectContaining({ condition: expect.objectContaining({ fieldPath: "active" }) }),
    );
  });

  it("shows condition fields when a condition exists and removes the stamp", async () => {
    const onAttachedRemove = vi.fn();
    const block = draftBlock("fetch_data_source", {}, {
      attachedBlocks: [
        draftBlock(
          "stamp_integritas",
          { condition: { source: "data", fieldPath: "active", operator: "equals", value: true } },
          { id: "stamp1" },
        ),
      ],
    });
    renderAttached(block, { onAttachedRemove });

    expect(screen.getByRole("textbox", { name: "Field path" })).toHaveValue("active");
    expect(screen.getByRole("combobox", { name: "Operator" })).toHaveValue("equals");
    expect(screen.getByRole("textbox", { name: "Compare value" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove stamp" }));
    expect(onAttachedRemove).toHaveBeenCalledWith("stamp1");
  });

  it("hides the compare value input for operators that need no value", () => {
    const block = draftBlock("fetch_data_source", {}, {
      attachedBlocks: [
        draftBlock(
          "stamp_integritas",
          { condition: { source: "data", fieldPath: "active", operator: "exists" } },
          { id: "stamp1" },
        ),
      ],
    });
    renderAttached(block);
    expect(screen.queryByRole("textbox", { name: "Compare value" })).not.toBeInTheDocument();
  });
});

describe("PersistedBlockInspector", () => {
  function persistedBlock(overrides: Partial<AutomationBlock> = {}): AutomationBlock {
    return {
      id: "b1",
      workflowId: "w1",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      type: "wait",
      enabled: true,
      order: 0,
      parentBlockId: null,
      config: { durationMs: 1000 },
      lastRunAt: null,
      lastError: null,
      ...overrides,
    } as AutomationBlock;
  }

  function renderPersisted(
    props: Partial<React.ComponentProps<typeof PersistedBlockInspector>> = {},
    ref?: React.Ref<PersistedBlockInspectorHandle>,
  ) {
    return render(
      <PersistedBlockInspector
        ref={ref}
        block={persistedBlock()}
        attachedBlocks={[]}
        sources={[]}
        addressBook={[]}
        walletStatus={null}
        busy={false}
        onDirty={vi.fn()}
        onAttachStamp={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateAttached={vi.fn()}
        onDelete={vi.fn()}
        onDeleteAttached={vi.fn()}
        {...props}
      />,
    );
  }

  it("shows a disabled-block notice when the block is disabled", () => {
    renderPersisted({ block: persistedBlock({ enabled: false }) });
    expect(
      screen.getByText("This block is disabled and will be skipped when the workflow runs."),
    ).toBeInTheDocument();
  });

  it("shows the block's lastError", () => {
    renderPersisted({ block: persistedBlock({ lastError: "boom" }) });
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("calls onDirty once config changes away from the persisted value", async () => {
    const onDirty = vi.fn();
    renderPersisted({ onDirty });
    const field = screen.getByRole("textbox", { name: "Wait duration ms" });
    await userEvent.clear(field);
    await userEvent.type(field, "2");
    expect(onDirty).toHaveBeenCalled();
  });

  it("flushes dirty config via the imperative handle, no-ops when clean", async () => {
    const onUpdate = vi.fn();
    const ref = createRef<PersistedBlockInspectorHandle>();
    renderPersisted({ onUpdate }, ref);

    ref.current?.flush();
    expect(onUpdate).not.toHaveBeenCalled();

    const field = screen.getByRole("textbox", { name: "Wait duration ms" });
    await userEvent.clear(field);
    await userEvent.type(field, "9");
    ref.current?.flush();
    expect(onUpdate).toHaveBeenCalledWith({ config: { durationMs: 9 } });
  });

  it("toggles enabled and merges dirty config into the update", async () => {
    const onUpdate = vi.fn();
    renderPersisted({ onUpdate });

    const field = screen.getByRole("textbox", { name: "Wait duration ms" });
    await userEvent.clear(field);
    await userEvent.type(field, "9");

    await userEvent.click(screen.getByRole("switch", { name: "Enabled" }));
    expect(onUpdate).toHaveBeenCalledWith({ config: { durationMs: 9 }, enabled: false });
  });

  it("shows Remove block for a removable block and calls onDelete", async () => {
    const onDelete = vi.fn();
    renderPersisted({ onDelete });
    await userEvent.click(screen.getByRole("button", { name: "Remove block" }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("hides Block actions for a start block", () => {
    renderPersisted({ block: persistedBlock({ type: "manual_start", config: {} }) });
    expect(screen.queryByText("Block actions")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove block" })).not.toBeInTheDocument();
  });

  it("shows Attach stamp for a data block with no stamp attached, calling onAttachStamp", async () => {
    const onAttachStamp = vi.fn();
    renderPersisted({
      block: persistedBlock({ type: "fetch_data_source", config: {} }),
      onAttachStamp,
    });
    await userEvent.click(screen.getByRole("button", { name: "Attach stamp" }));
    expect(onAttachStamp).toHaveBeenCalled();
  });

  it("hides Attach stamp once a stamp is already attached", () => {
    renderPersisted({
      block: persistedBlock({ type: "fetch_data_source", config: {} }),
      attachedBlocks: [persistedBlock({ id: "stamp1", type: "stamp_integritas", config: {} })],
    });
    expect(screen.queryByRole("button", { name: "Attach stamp" })).not.toBeInTheDocument();
  });
});
