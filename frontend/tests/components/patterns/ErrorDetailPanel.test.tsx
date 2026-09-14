import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorDetailPanel } from "../../../src/components/patterns/ErrorDetailPanel";

describe("ErrorDetailPanel", () => {
  it("renders the normalized message and raw JSON", () => {
    render(<ErrorDetailPanel error="Something broke" />);

    expect(screen.getByText("Message")).toBeInTheDocument();
    expect(screen.getByText("Something broke")).toBeInTheDocument();
    expect(screen.getByText(/"Something broke"/)).toBeInTheDocument();
  });

  it("renders caller-supplied extra rows", () => {
    render(<ErrorDetailPanel error="Failed" extraRows={<div>Occurred at 12:00</div>} />);
    expect(screen.getByText("Occurred at 12:00")).toBeInTheDocument();
  });
});
