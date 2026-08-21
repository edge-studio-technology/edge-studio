import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChangeCredentialPanel } from "../../../src/features/auth/ChangeCredentialPanel";

const changePassword = vi.fn();

vi.mock("../../../src/features/auth/api", () => ({
  changePassword: (...args: unknown[]) => changePassword(...args),
}));

describe("ChangeCredentialPanel", () => {
  beforeEach(() => {
    changePassword.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to the PIN tab with the submit button disabled", () => {
    render(<ChangeCredentialPanel />);

    expect(screen.getByRole("tab", { name: "6-digit PIN" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Change credential" })).toBeDisabled();
  });

  it("submits a matching PIN change and shows a success message", async () => {
    changePassword.mockResolvedValue({ success: true });
    render(<ChangeCredentialPanel />);

    await userEvent.type(screen.getByLabelText("Current PIN or password"), "111111");
    await userEvent.type(screen.getByLabelText("New PIN"), "222222");
    await userEvent.type(screen.getByLabelText("Confirm new PIN"), "222222");

    const submit = screen.getByRole("button", { name: "Change credential" });
    expect(submit).toBeEnabled();
    await userEvent.click(submit);

    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: "111111",
      newPassword: "222222",
    });
    expect(await screen.findByText("Credential changed successfully.")).toBeInTheDocument();
    expect(screen.getByLabelText("Current PIN or password")).toHaveValue("");
  });

  it("shows a mismatch error and keeps submit disabled when the PIN confirmation differs", async () => {
    render(<ChangeCredentialPanel />);

    await userEvent.type(screen.getByLabelText("Current PIN or password"), "111111");
    await userEvent.type(screen.getByLabelText("New PIN"), "222222");
    await userEvent.type(screen.getByLabelText("Confirm new PIN"), "333333");

    expect(screen.getByText("PINs do not match")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change credential" })).toBeDisabled();
  });

  it("switches to the password tab and shows password requirements", async () => {
    render(<ChangeCredentialPanel />);

    await userEvent.click(screen.getByRole("tab", { name: "Password" }));

    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Password requirements")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change credential" })).toBeDisabled();
  });

  it("submits a valid password change", async () => {
    changePassword.mockResolvedValue({ success: true });
    render(<ChangeCredentialPanel />);

    await userEvent.click(screen.getByRole("tab", { name: "Password" }));
    await userEvent.type(screen.getByLabelText("Current PIN or password"), "old-pass");
    await userEvent.type(screen.getByLabelText("New password"), "Abcdef1!");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "Abcdef1!");

    const submit = screen.getByRole("button", { name: "Change credential" });
    expect(submit).toBeEnabled();
    await userEvent.click(submit);

    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: "old-pass",
      newPassword: "Abcdef1!",
    });
    expect(await screen.findByText("Credential changed successfully.")).toBeInTheDocument();
  });

  it("shows a mismatch error for the password confirmation field", async () => {
    render(<ChangeCredentialPanel />);

    await userEvent.click(screen.getByRole("tab", { name: "Password" }));
    await userEvent.type(screen.getByLabelText("New password"), "Abcdef1!");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "Different1!");

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });

  it("shows the API error and does not clear the form when the request fails", async () => {
    changePassword.mockRejectedValue(new Error("wrong current credential"));
    render(<ChangeCredentialPanel />);

    await userEvent.type(screen.getByLabelText("Current PIN or password"), "111111");
    await userEvent.type(screen.getByLabelText("New PIN"), "222222");
    await userEvent.type(screen.getByLabelText("Confirm new PIN"), "222222");
    await userEvent.click(screen.getByRole("button", { name: "Change credential" }));

    expect(await screen.findByText("wrong current credential")).toBeInTheDocument();
    expect(screen.getByLabelText("Current PIN or password")).toHaveValue("111111");
  });

  it("resets new-credential fields when switching credential type", async () => {
    render(<ChangeCredentialPanel />);

    await userEvent.type(screen.getByLabelText("New PIN"), "222222");
    await userEvent.click(screen.getByRole("tab", { name: "Password" }));
    await userEvent.click(screen.getByRole("tab", { name: "6-digit PIN" }));

    expect(screen.getByLabelText("New PIN")).toHaveValue("");
  });
});
