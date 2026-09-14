import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AutomationValidationResult, AutomationWorkflow } from "../../../../src/features/automation/automationTypes";
import {
  BlockHelpDisclosure,
  IconAction,
  InspectorSection,
  isWorkflowValidationVisible,
  Panel,
  RulePart,
  RuntimeStat,
  SaveState,
  SelectedBlockSheet,
  StatusPill,
  ValidationIssueRow,
  WorkflowStatusPill,
  WorkflowStatusStrip,
  WorkflowValidationPanel,
} from "../../../../src/features/automation/workflow/workflowWorkspaceUi";

function workflow(overrides: Partial<AutomationWorkflow> = {}): AutomationWorkflow {
  return {
    id: "w1",
    createdAt: "now",
    updatedAt: "now",
    name: "Flow",
    enabled: true,
    archived: false,
    lastRunAt: null,
    nextRunAt: null,
    lastHash: null,
    lastProofId: null,
    lastError: null,
    blocks: [],
    ...overrides,
  };
}

describe("StatusPill", () => {
  it("renders its children with an indicator", () => {
    render(<StatusPill status="good">Ready</StatusPill>);
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });
});

describe("WorkflowStatusPill", () => {
  it("shows Archived for an archived workflow regardless of other state", () => {
    render(<WorkflowStatusPill workflow={workflow({ archived: true, lastError: "boom" })} />);
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("shows Error when there is a lastError and not archived", () => {
    render(<WorkflowStatusPill workflow={workflow({ lastError: "boom" })} />);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("shows Enabled when enabled with no error", () => {
    render(<WorkflowStatusPill workflow={workflow({ enabled: true })} />);
    expect(screen.getByText("Enabled")).toBeInTheDocument();
  });

  it("shows Paused when disabled with no error", () => {
    render(<WorkflowStatusPill workflow={workflow({ enabled: false })} />);
    expect(screen.getByText("Paused")).toBeInTheDocument();
  });
});

describe("WorkflowStatusStrip", () => {
  it("renders children within a status role container", () => {
    render(
      <WorkflowStatusStrip>
        <span>Chip</span>
      </WorkflowStatusStrip>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Chip");
  });
});

describe("IconAction", () => {
  it("renders a titled, labeled icon button that calls onClick", async () => {
    const onClick = vi.fn();
    render(
      <IconAction title="Delete" label="Delete workflow" onClick={onClick}>
        <span>X</span>
      </IconAction>,
    );
    const button = screen.getByRole("button", { name: "Delete workflow" });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });
});

describe("Panel", () => {
  it("renders children", () => {
    render(<Panel>Panel content</Panel>);
    expect(screen.getByText("Panel content")).toBeInTheDocument();
  });
});

describe("isWorkflowValidationVisible", () => {
  it("is visible when there is a fetch error", () => {
    expect(isWorkflowValidationVisible(null, [], "network down")).toBe(true);
  });

  it("is visible when there is no validation yet and no local errors", () => {
    expect(isWorkflowValidationVisible(null, [])).toBe(true);
  });

  it("is visible when there are local errors, backend errors, or warnings", () => {
    const passed: AutomationValidationResult = { ok: true, errors: [], warnings: [] };
    expect(isWorkflowValidationVisible(passed, ["Missing name"])).toBe(true);
    expect(
      isWorkflowValidationVisible({ ok: false, errors: [{ level: "error", code: "x", message: "Bad" }], warnings: [] }),
    ).toBe(true);
    expect(
      isWorkflowValidationVisible({ ok: true, errors: [], warnings: [{ level: "warning", code: "w", message: "Careful" }] }),
    ).toBe(true);
  });

  it("is hidden once validation passed cleanly with no local errors", () => {
    expect(isWorkflowValidationVisible({ ok: true, errors: [], warnings: [] }, [])).toBe(false);
  });
});

describe("WorkflowValidationPanel", () => {
  it("renders nothing once validation passed cleanly", () => {
    const { container } = render(
      <WorkflowValidationPanel validation={{ ok: true, errors: [], warnings: [] }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a Checking state while validation has not resolved and there are no local errors", () => {
    render(<WorkflowValidationPanel validation={null} />);
    expect(screen.getByText("Checking")).toBeInTheDocument();
  });

  it("shows an Unavailable state with the fetch error message", async () => {
    render(<WorkflowValidationPanel validation={null} fetchError="network down" />);
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Validation"));
    expect(screen.getByText("network down")).toBeInTheDocument();
  });

  it("summarizes error and warning counts and lists grouped issues", async () => {
    render(
      <WorkflowValidationPanel
        validation={{
          ok: false,
          errors: [{ level: "error", code: "x", message: "Missing source", blockType: "fetch_data_source" }],
          warnings: [{ level: "warning", code: "y", message: "Low balance" }],
        }}
        localErrors={["Name is required"]}
      />,
    );
    expect(screen.getByText("2 errors, 1 warning")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Validation"));
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText(/Missing source/)).toBeInTheDocument();
    expect(screen.getByText("Low balance")).toBeInTheDocument();
  });
});

describe("SelectedBlockSheet", () => {
  it("renders in a dialog with title/description/children/footer and calls onClose", async () => {
    const onClose = vi.fn();
    render(
      <SelectedBlockSheet
        title="Wait"
        description="Configure the wait block."
        onClose={onClose}
        footer={<button type="button">Done</button>}
      >
        <p>Body</p>
      </SelectedBlockSheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Wait" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Configure the wait block.")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close wait" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape", async () => {
    const onClose = vi.fn();
    render(
      <SelectedBlockSheet title="Wait" onClose={onClose}>
        <p>Body</p>
      </SelectedBlockSheet>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

describe("InspectorSection", () => {
  it("renders a title, optional description, and children", () => {
    render(
      <InspectorSection title="Configuration" description="Set it up.">
        <p>Field</p>
      </InspectorSection>,
    );
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Set it up.")).toBeInTheDocument();
    expect(screen.getByText("Field")).toBeInTheDocument();
  });
});

describe("BlockHelpDisclosure", () => {
  it("shows the block's tooltip, what-it-does, when-to-use, and a link to the full guide", async () => {
    render(
      <MemoryRouter>
        <BlockHelpDisclosure type="wait" />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByText("About this block"));
    expect(screen.getByText("Delays the workflow before continuing to the next block.")).toBeInTheDocument();
    expect(screen.getByText("What it does")).toBeInTheDocument();
    expect(screen.getByText("When to use it")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Open full guide" });
    expect(link).toHaveAttribute("href", "/workflows/help#wait");
  });

  it("shows the field reference table for a block with fields", async () => {
    render(
      <MemoryRouter>
        <BlockHelpDisclosure type="schedule_start" />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByText("About this block"));
    expect(screen.getByText("Fields")).toBeInTheDocument();
    expect(screen.getByText("Interval")).toBeInTheDocument();
    expect(screen.getByText("Required")).toBeInTheDocument();
  });
});

describe("RuntimeStat", () => {
  it("renders a label/value row", () => {
    render(<RuntimeStat label="Duration" value="1.0 s" />);
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("1.0 s")).toBeInTheDocument();
  });
});

describe("ValidationIssueRow", () => {
  it("shows the issue level, message, block type, and block count when > 1", () => {
    render(
      <ValidationIssueRow
        issue={{ level: "error", code: "x", message: "Missing source", blockType: "fetch_data_source" }}
        count={3}
      />,
    );
    expect(screen.getByText("error")).toBeInTheDocument();
    expect(screen.getByText("Missing source (fetch_data_source) · 3 blocks")).toBeInTheDocument();
  });
});

describe("SaveState", () => {
  it("shows Unsaved changes when dirty", () => {
    render(<SaveState dirty saved={false} />);
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("shows Saved when saved and not dirty", () => {
    render(<SaveState dirty={false} saved />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("shows No unsaved changes otherwise", () => {
    render(<SaveState dirty={false} saved={false} />);
    expect(screen.getByText("No unsaved changes")).toBeInTheDocument();
  });
});

describe("RulePart", () => {
  it("renders a title and value", () => {
    render(<RulePart title="When" value="GPIO event" />);
    expect(screen.getByText("When")).toBeInTheDocument();
    expect(screen.getByText("GPIO event")).toBeInTheDocument();
  });
});
