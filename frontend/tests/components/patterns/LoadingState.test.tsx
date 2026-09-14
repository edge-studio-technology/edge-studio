import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingState } from "../../../src/components/patterns/LoadingState";

describe("LoadingState", () => {
  it("renders a status region with a screen-reader-only label when no title is given", () => {
    render(<LoadingState />);
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("renders title and description when given", () => {
    render(<LoadingState title="Loading sources" description="Please wait" />);
    expect(screen.getByText("Loading sources")).toBeInTheDocument();
    expect(screen.getByText("Please wait")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(
      <LoadingState title="Loading">
        <button>Cancel</button>
      </LoadingState>,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});
