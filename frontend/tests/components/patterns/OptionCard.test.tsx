import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OptionCard } from "../../../src/components/patterns/OptionCard";

describe("OptionCard", () => {
  it("renders eyebrow, title, description, and action label", () => {
    render(
      <OptionCard
        eyebrow="Step 1"
        title="Connect a source"
        description="Pick a source type"
        actionLabel="Choose"
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Connect a source")).toBeInTheDocument();
    expect(screen.getByText("Pick a source type")).toBeInTheDocument();
    expect(screen.getByText("Choose")).toBeInTheDocument();
  });

  it("calls onClick when the whole card is clicked", async () => {
    const onClick = vi.fn();
    render(<OptionCard title="Connect a source" actionLabel="Choose" onClick={onClick} />);

    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
