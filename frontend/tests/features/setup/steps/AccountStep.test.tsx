import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { isValidAdminCredential } from "../../../../src/features/auth/adminCredentials";
import { AccountStep } from "../../../../src/features/setup/steps/AccountStep";
import type { OnboardingFormState } from "../../../../src/features/setup/types";

const initialForm: OnboardingFormState = {
  credentialType: "pin",
  password: "",
  confirmPassword: "",
  twoFactorCode: "",
};

function ControlledAccountStep({
  onSubmit = vi.fn(),
  submitting = false,
  canGoBack = false,
  onBack = vi.fn(),
  continueLabel = "Continue",
}: {
  onSubmit?: () => void;
  submitting?: boolean;
  canGoBack?: boolean;
  onBack?: () => void;
  continueLabel?: string;
}) {
  const [form, setFormState] = useState<OnboardingFormState>(initialForm);
  const setForm = (patch: Partial<OnboardingFormState>) =>
    setFormState((prev) => ({ ...prev, ...patch }));
  const canContinue =
    isValidAdminCredential(form.credentialType, form.password) &&
    form.password === form.confirmPassword;

  return (
    <AccountStep
      form={form}
      setForm={setForm}
      onSubmit={onSubmit}
      progressCurrent={1}
      progressTotal={2}
      canGoBack={canGoBack}
      onBack={onBack}
      canContinue={canContinue}
      continueLabel={continueLabel}
      submitting={submitting}
    />
  );
}

describe("AccountStep", () => {
  it("renders PIN fields by default", () => {
    render(<ControlledAccountStep />);

    expect(screen.getByText("Choose PIN or password")).toBeInTheDocument();
    expect(screen.getByLabelText("PIN")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm PIN")).toBeInTheDocument();
  });

  it("disables continue until a matching PIN is entered, then enables it", async () => {
    render(<ControlledAccountStep />);

    const button = screen.getByRole("button", { name: "Continue" });
    expect(button).toBeDisabled();

    await userEvent.type(screen.getByLabelText("PIN"), "123456");
    await userEvent.type(screen.getByLabelText("Confirm PIN"), "123456");

    expect(button).toBeEnabled();
  });

  it("shows a mismatch error once the confirm PIN is fully entered but does not match", async () => {
    render(<ControlledAccountStep />);

    await userEvent.type(screen.getByLabelText("PIN"), "123456");
    await userEvent.type(screen.getByLabelText("Confirm PIN"), "654321");

    expect(screen.getByText("PINs do not match")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("calls onSubmit when the form is submitted with a valid matching PIN", async () => {
    const onSubmit = vi.fn();
    render(<ControlledAccountStep onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText("PIN"), "123456");
    await userEvent.type(screen.getByLabelText("Confirm PIN"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("switches to password fields and shows password requirements", async () => {
    render(<ControlledAccountStep />);

    await userEvent.click(screen.getByRole("tab", { name: "Password" }));

    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    expect(screen.getByLabelText("Password requirements")).toBeInTheDocument();
    expect(screen.queryByLabelText("PIN")).not.toBeInTheDocument();
  });

  it("shows a mismatch error for passwords once confirm is at least as long as password", async () => {
    render(<ControlledAccountStep />);
    await userEvent.click(screen.getByRole("tab", { name: "Password" }));

    await userEvent.type(screen.getByLabelText("Password"), "Str0ng!Pass");
    await userEvent.type(screen.getByLabelText("Confirm password"), "Different!11");

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });

  it("resets password fields when switching credential type", async () => {
    render(<ControlledAccountStep />);

    await userEvent.type(screen.getByLabelText("PIN"), "1234");
    await userEvent.click(screen.getByRole("tab", { name: "Password" }));
    await userEvent.click(screen.getByRole("tab", { name: "6-digit PIN" }));

    expect(screen.getByLabelText("PIN")).toHaveValue("");
  });

  it("disables continue while submitting even with a valid matching PIN", async () => {
    render(<ControlledAccountStep submitting continueLabel="Securing device…" />);

    await userEvent.type(screen.getByLabelText("PIN"), "123456");
    await userEvent.type(screen.getByLabelText("Confirm PIN"), "123456");

    expect(screen.getByRole("button", { name: "Securing device…" })).toBeDisabled();
  });

  it("shows a back control when canGoBack is true", () => {
    const onBack = vi.fn();
    render(<ControlledAccountStep canGoBack onBack={onBack} />);

    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
  });
});
