import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TruncatedHash } from "../../../src/components/ui/TruncatedHash";

describe("TruncatedHash", () => {
  it("renders the short form of a long value", () => {
    const value = "Mx" + "a".repeat(40);
    render(<TruncatedHash value={value} />);
    expect(screen.getByText(`${value.slice(0, 8)}…${value.slice(-6)}`)).toBeInTheDocument();
  });

  it("sets the full value as the title attribute", () => {
    const value = "Mx" + "a".repeat(40);
    render(<TruncatedHash value={value} />);
    expect(screen.getByTitle(value)).toBeInTheDocument();
  });

  it("renders short values unchanged", () => {
    render(<TruncatedHash value="short" />);
    expect(screen.getByText("short")).toBeInTheDocument();
  });

  it("copies the full value on click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const value = "Mx" + "a".repeat(40);
    render(<TruncatedHash value={value} />);

    await userEvent.click(screen.getByRole("button", { name: `Copy ${value}` }));

    expect(writeText).toHaveBeenCalledWith(value);
    expect(screen.getByRole("button", { name: `Copied ${value}` })).toHaveTextContent("Copied");
  });
});
