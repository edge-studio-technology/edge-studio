import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollArea } from "../../../src/components/ui/ScrollArea";

describe("ScrollArea", () => {
  it("renders children", () => {
    render(<ScrollArea>Content</ScrollArea>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("reserves gutter space by default", () => {
    render(<ScrollArea>Content</ScrollArea>);
    expect(screen.getByText("Content")).toHaveClass("scrollbar-gutter-stable");
  });

  it("omits the gutter class when stableGutter is false", () => {
    render(<ScrollArea stableGutter={false}>Content</ScrollArea>);
    expect(screen.getByText("Content")).not.toHaveClass("scrollbar-gutter-stable");
  });

  it("merges a custom className", () => {
    render(<ScrollArea className="custom-class">Content</ScrollArea>);
    expect(screen.getByText("Content")).toHaveClass("custom-class");
  });
});
