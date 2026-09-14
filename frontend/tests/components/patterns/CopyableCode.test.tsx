import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyableCode } from "../../../src/components/patterns/CopyableCode";
import { ToastProvider } from "../../../src/components/ToastProvider";

describe("CopyableCode", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the value", () => {
    render(<CopyableCode value="abc123" />, { wrapper: ToastProvider });
    expect(screen.getByText("abc123")).toBeInTheDocument();
  });

  it("copies the value to the clipboard and shows a success toast", async () => {
    render(<CopyableCode value="abc123" />, { wrapper: ToastProvider });

    await userEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("abc123");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    });
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("shows an error toast when the clipboard write fails", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<CopyableCode value="abc123" />, { wrapper: ToastProvider });

    await userEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));

    await waitFor(() => {
      expect(screen.getByText("Copy failed")).toBeInTheDocument();
    });
  });
});
