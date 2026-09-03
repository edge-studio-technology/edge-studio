import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProgressBar } from "../../../src/components/ui/ProgressBar";

describe("ProgressBar", () => {
  it("renders a progressbar with the current/total values", () => {
    render(<ProgressBar current={2} total={5} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "2");
    expect(bar).toHaveAttribute("aria-valuemax", "5");
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });

  it("clamps current within [0, total]", () => {
    render(<ProgressBar current={10} total={5} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "5");
  });

  it("shows a back button and calls onBack when clicked", async () => {
    const onBack = vi.fn();
    render(<ProgressBar current={1} total={5} onBack={onBack} />);

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("hides the back button when showBack is false", () => {
    render(<ProgressBar current={1} total={5} showBack={false} />);
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("disables the back button when onBack is not given", () => {
    render(<ProgressBar current={1} total={5} />);
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });
});
