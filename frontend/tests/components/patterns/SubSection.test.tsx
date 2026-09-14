import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SubSection } from "../../../src/components/patterns/SubSection";

describe("SubSection", () => {
  it("renders icon, title, description, and children", () => {
    render(
      <SubSection icon={<span data-testid="icon" />} title="Advanced" description="More options">
        <p>Body</p>
      </SubSection>,
    );

    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toBeInTheDocument();
    expect(screen.getByText("More options")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });
});
