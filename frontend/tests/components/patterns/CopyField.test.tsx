import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyField } from "../../../src/components/patterns/CopyField";

describe("CopyField", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders label, value, and optional description", () => {
    render(<CopyField label="API key" value="abc123" description="Keep this secret" />);

    expect(screen.getByText("API key")).toBeInTheDocument();
    expect(screen.getByText("abc123")).toBeInTheDocument();
    expect(screen.getByText("Keep this secret")).toBeInTheDocument();
  });

  it("copies the value and toggles the button label to Copied", async () => {
    render(<CopyField label="API key" value="abc123" />);

    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("abc123");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    });
  });
});
