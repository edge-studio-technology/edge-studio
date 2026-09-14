import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MutedText } from "../../src/components/Text";

// `Text` and `ErrorText` are re-exported unchanged from components/ui and are
// already covered by tests/components/ui/Text.test.tsx and ErrorText.test.tsx.
// Only `MutedText`, defined in this file, has logic of its own to test here.
describe("MutedText", () => {
  it("renders its children", () => {
    render(<MutedText>Muted copy</MutedText>);
    expect(screen.getByText("Muted copy")).toBeInTheDocument();
  });

  it("applies the muted text color class and an additional className", () => {
    render(<MutedText className="extra-class">Muted copy</MutedText>);
    const el = screen.getByText("Muted copy");
    expect(el).toHaveClass("text-slate-500", "extra-class");
  });
});
