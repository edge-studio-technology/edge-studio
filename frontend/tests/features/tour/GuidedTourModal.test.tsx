import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Radio, Shield } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { GuidedTourModal } from "../../../src/features/tour/GuidedTourModal";
import { tourSteps, type TourStep } from "../../../src/features/tour/tourSteps";

const steps: TourStep[] = [
  {
    id: "one",
    title: "First step",
    lead: "First lead.",
    points: ["First point", "Second point"],
    icon: Radio,
  },
  {
    id: "two",
    title: "Second step",
    lead: "Second lead.",
    points: ["Only point"],
    icon: Shield,
    image: "/tour/second.png",
    imageAlt: "Second screenshot",
  },
];

function renderTour(onClose = vi.fn()) {
  render(<GuidedTourModal onClose={onClose} steps={steps} />);
  return onClose;
}

describe("GuidedTourModal", () => {
  it("renders the first step with progress and no Back button", () => {
    renderTour();
    expect(screen.getByRole("dialog", { name: "First step" })).toBeInTheDocument();
    expect(screen.getByText("First lead.")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "First point",
      "Second point",
    ]);
    expect(screen.getByRole("progressbar", { name: "Tour progress" })).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("shows the screenshot placeholder when a step has no image", () => {
    renderTour();
    expect(screen.getByText("Screenshot coming soon")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("moves forward and back between steps", async () => {
    const onClose = renderTour();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: "Second step" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Tour progress" })).toHaveAttribute(
      "aria-valuenow",
      "2",
    );

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog", { name: "First step" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the step image and closes on Finish from the last step", async () => {
    const onClose = renderTour();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("img", { name: "Second screenshot" })).toHaveAttribute(
      "src",
      "/tour/second.png",
    );
    expect(screen.queryByText("Screenshot coming soon")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Skip tour", async () => {
    const onClose = renderTour();
    await userEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on the X button", async () => {
    const onClose = renderTour();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    const onClose = renderTour();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores backdrop presses", () => {
    const onClose = renderTour();
    const backdrop = screen.getByRole("dialog").closest('[role="presentation"]');
    fireEvent.mouseDown(backdrop!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the brand lockup instead of a screenshot on a brand step", () => {
    render(
      <GuidedTourModal
        onClose={vi.fn()}
        steps={[{ ...steps[0], brand: true, image: "/tour/ignored.png", imageAlt: "Ignored" }]}
      />,
    );
    expect(screen.getByRole("img", { name: "Edge Studio" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Ignored" })).not.toBeInTheDocument();
    expect(screen.queryByText("Screenshot coming soon")).not.toBeInTheDocument();
  });

  it("uses the built-in tour steps by default", () => {
    render(<GuidedTourModal onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: tourSteps[0].title })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Tour progress" })).toHaveAttribute(
      "aria-valuemax",
      String(tourSteps.length),
    );
  });
});
