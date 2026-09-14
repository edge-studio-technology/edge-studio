import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MinimaStatCell, MinimaStatGrid } from "../../../src/features/minima/MinimaStatCell";

describe("MinimaStatCell", () => {
  it("renders the label and value", () => {
    render(<MinimaStatCell label="Active peers" value="4" />);
    expect(screen.getByText("Active peers")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});

describe("MinimaStatGrid", () => {
  it("renders the title, badge, footer, and children", () => {
    render(
      <MinimaStatGrid title="Node health" badge={<span>Badge</span>} footer={<span>Footer</span>}>
        <div>Child content</div>
      </MinimaStatGrid>,
    );
    expect(screen.getByText("Node health")).toBeInTheDocument();
    expect(screen.getByText("Badge")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders without a badge or footer", () => {
    render(<MinimaStatGrid title="Node health">Body</MinimaStatGrid>);
    expect(screen.getByText("Node health")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });
});
