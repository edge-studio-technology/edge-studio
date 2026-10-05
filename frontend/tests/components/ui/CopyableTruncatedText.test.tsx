import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CopyableTruncatedText } from "../../../src/components/ui/CopyableTruncatedText";

describe("CopyableTruncatedText", () => {
  it("renders the display value and copies the full value", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<CopyableTruncatedText value="Full workflow name" display="1 workflow" />);

    await userEvent.click(screen.getByRole("button", { name: "Copy Full workflow name" }));

    expect(writeText).toHaveBeenCalledWith("Full workflow name");
    expect(screen.getByRole("button", { name: "Copied Full workflow name" })).toHaveTextContent("Copied");
    expect(screen.getByText("1 workflow")).toHaveClass("invisible");
  });

  it("applies the requested table text role", () => {
    render(<CopyableTruncatedText value="Failed run" meta tone="error" />);

    expect(screen.getByRole("button", { name: "Copy Failed run" })).toHaveClass("type-meta", "text-text-error");
  });
});
