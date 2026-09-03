import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorText } from "../../../src/components/ui/ErrorText";

describe("ErrorText", () => {
  it("renders as an alert with the given text", () => {
    render(<ErrorText>Something went wrong</ErrorText>);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("merges a custom className", () => {
    render(<ErrorText className="custom-class">Error</ErrorText>);
    expect(screen.getByRole("alert")).toHaveClass("custom-class");
  });
});
