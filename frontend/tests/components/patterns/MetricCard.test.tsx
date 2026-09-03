import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricCard } from "../../../src/components/patterns/MetricCard";

describe("MetricCard", () => {
  it("renders label, value, and description", () => {
    render(<MetricCard label="Uptime" value="99.9%" description="Last 30 days" />);

    expect(screen.getByText("Uptime")).toBeInTheDocument();
    expect(screen.getByText("99.9%")).toBeInTheDocument();
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
  });

  it("renders loading dots instead of the value when loading", () => {
    render(<MetricCard label="Uptime" value="99.9%" loading />);
    expect(screen.queryByText("99.9%")).not.toBeInTheDocument();
  });

  it("renders children", () => {
    render(
      <MetricCard label="Uptime" value="99.9%">
        <button>Details</button>
      </MetricCard>,
    );
    expect(screen.getByRole("button", { name: "Details" })).toBeInTheDocument();
  });
});
