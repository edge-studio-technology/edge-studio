import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClearPreviousHistoryModal } from "../../../src/features/wallet/ClearPreviousHistoryModal";

vi.mock("../../../src/features/auth/hooks", () => ({
  useAuth: () => ({ user: { credentialType: "password" }, credentialType: "password" }),
}));

const clearPreviousWalletHistory = vi.fn();
vi.mock("../../../src/features/wallet/walletApi", () => ({
  clearPreviousWalletHistory: (...args: unknown[]) => clearPreviousWalletHistory(...args),
}));

function renderModal(props: Partial<Parameters<typeof ClearPreviousHistoryModal>[0]> = {}) {
  const onClose = vi.fn();
  const onCleared = vi.fn();
  render(<ClearPreviousHistoryModal itemCount={1} onClose={onClose} onCleared={onCleared} {...props} />);
  return { onClose, onCleared };
}

beforeEach(() => {
  clearPreviousWalletHistory.mockReset();
});

describe("ClearPreviousHistoryModal", () => {
  it("requires the current credential before clearing", async () => {
    renderModal();

    expect(screen.getByText(/1 item recorded under a wallet/)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Clear history" });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Current password"), "secret");
    expect(confirm).toBeEnabled();
  });

  it("reports the deleted count when the credential is accepted", async () => {
    clearPreviousWalletHistory.mockResolvedValue({ deleted: 3 });
    const { onCleared } = renderModal({ itemCount: 3 });

    await userEvent.type(screen.getByLabelText("Current password"), "secret{Enter}");

    expect(clearPreviousWalletHistory).toHaveBeenCalledWith("secret");
    expect(onCleared).toHaveBeenCalledWith(3);
  });

  it("shows a rejected credential and clears the message on edit", async () => {
    clearPreviousWalletHistory.mockRejectedValue(new Error("Current password is incorrect"));
    const { onCleared } = renderModal();

    await userEvent.type(screen.getByLabelText("Current password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Clear history" }));

    expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
    expect(onCleared).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Clear history" })).toBeEnabled();
    await userEvent.type(screen.getByLabelText("Current password"), "x");
    expect(screen.queryByText("Current password is incorrect")).not.toBeInTheDocument();
  });

  it("closes on cancel", async () => {
    const { onClose } = renderModal();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
  });
});
