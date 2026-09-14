import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReceiveQrPanel } from "../../../src/features/wallet/ReceiveQrPanel";

const getReceiveAddress = vi.fn();

vi.mock("../../../src/features/wallet/walletApi", () => ({
  getReceiveAddress: (...args: unknown[]) => getReceiveAddress(...args),
}));

function address(overrides: Partial<{ miniAddress: string; address: string; qrDataUrl: string }> = {}) {
  return {
    miniAddress: "Mx1234567890",
    address: "0xabc",
    qrDataUrl: "data:image/png;base64,abc",
    ...overrides,
  };
}

describe("ReceiveQrPanel", () => {
  beforeEach(() => {
    getReceiveAddress.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("fetches and shows the QR code when not disabled", async () => {
    getReceiveAddress.mockResolvedValue(address());
    render(<ReceiveQrPanel disabled={false} />);

    const img = await screen.findByAltText("QR code for this wallet receive address");
    expect(img).toHaveAttribute("src", "data:image/png;base64,abc");
    expect(getReceiveAddress).toHaveBeenCalled();
  });

  it("does not fetch and shows a disabled placeholder when disabled", async () => {
    render(<ReceiveQrPanel disabled />);

    expect(screen.queryByAltText("QR code for this wallet receive address")).not.toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getReceiveAddress).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Copy address" })).toBeDisabled();
  });

  it("shows an error message when the fetch fails", async () => {
    getReceiveAddress.mockRejectedValue(new Error("could not reach node"));
    render(<ReceiveQrPanel disabled={false} />);

    expect(await screen.findByText("could not reach node")).toBeInTheDocument();
  });

  it("copies the address to the clipboard and shows a copied state", async () => {
    getReceiveAddress.mockResolvedValue(address());
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(<ReceiveQrPanel disabled={false} />);
    await screen.findByAltText("QR code for this wallet receive address");

    await userEvent.click(screen.getByRole("button", { name: "Copy address" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Mx1234567890");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("shows an error when the clipboard write fails", async () => {
    getReceiveAddress.mockResolvedValue(address());
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<ReceiveQrPanel disabled={false} />);
    await screen.findByAltText("QR code for this wallet receive address");

    await userEvent.click(screen.getByRole("button", { name: "Copy address" }));

    expect(await screen.findByText("Could not copy address.")).toBeInTheDocument();
  });

  it("re-fetches on the refresh interval while enabled", async () => {
    vi.useFakeTimers();
    getReceiveAddress.mockResolvedValue(address());
    render(<ReceiveQrPanel disabled={false} />);

    await vi.waitFor(() => expect(getReceiveAddress).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
    expect(getReceiveAddress).toHaveBeenCalledTimes(2);
  });

  it("stops polling when the tab becomes hidden and resumes when visible again", async () => {
    vi.useFakeTimers();
    getReceiveAddress.mockResolvedValue(address());
    render(<ReceiveQrPanel disabled={false} />);
    await vi.waitFor(() => expect(getReceiveAddress).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
    expect(getReceiveAddress).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() => expect(getReceiveAddress).toHaveBeenCalledTimes(2));
  });
});
