import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  WorkflowRailHeader,
  WorkflowRailPanel,
} from "../../../../../src/features/automation/workflow/chrome/WorkflowRail";

describe("WorkflowRailPanel", () => {
  it("renders its children inside a scroll area", () => {
    render(
      <WorkflowRailPanel>
        <p>Rail content</p>
      </WorkflowRailPanel>,
    );
    expect(screen.getByText("Rail content")).toBeInTheDocument();
  });
});

describe("WorkflowRailHeader", () => {
  it("renders a title and description", () => {
    render(<WorkflowRailHeader title="Toolkit" description="Choose a block." />);
    expect(screen.getByText("Toolkit")).toBeInTheDocument();
    expect(screen.getByText("Choose a block.")).toBeInTheDocument();
  });
});
