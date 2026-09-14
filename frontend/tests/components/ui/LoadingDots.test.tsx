import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingDots } from "../../../src/components/ui/LoadingDots";

describe("LoadingDots", () => {
  it("renders a status role labeled Loading", () => {
    render(<LoadingDots />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("merges a custom className", () => {
    render(<LoadingDots className="custom-class" />);
    expect(screen.getByRole("status")).toHaveClass("custom-class");
  });
});
