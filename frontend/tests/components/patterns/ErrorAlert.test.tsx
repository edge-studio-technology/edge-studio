import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorAlert } from "../../../src/components/patterns/ErrorAlert";

describe("ErrorAlert", () => {
  it("renders as an alert with title and children by default", () => {
    render(<ErrorAlert title="Failed">Something went wrong.</ErrorAlert>);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
  });

  it("renders as a status role for warning status", () => {
    render(<ErrorAlert status="warning">Heads up.</ErrorAlert>);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the given action content", () => {
    render(<ErrorAlert action={<button>Retry</button>}>Failed to load.</ErrorAlert>);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders an attention notice as a compact classification row", () => {
    render(
      <ErrorAlert status="attention" variant="compact" title="Review configuration">
        Details
      </ErrorAlert>,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Attention")).toBeInTheDocument();
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
  });
});
