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

    expect(screen.getByText("1 workflow")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith("Full workflow name");
  });
});
