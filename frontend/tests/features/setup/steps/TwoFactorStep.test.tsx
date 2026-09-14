import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TwoFactorStep } from "../../../../src/features/setup/steps/TwoFactorStep";
import type { CheckState, OnboardingFormState } from "../../../../src/features/setup/types";

const baseForm: OnboardingFormState = {
  credentialType: "pin",
  password: "",
  confirmPassword: "",
  twoFactorCode: "",
};

function ControlledTwoFactorStep({
  qrCode = "data:image/png;base64,abc",
  checkState = "idle",
  onVerifyCode = vi.fn(),
}: {
  qrCode?: string | null;
  checkState?: CheckState;
  onVerifyCode?: () => void;
}) {
  const [form, setFormState] = useState<OnboardingFormState>(baseForm);
  const setForm = (patch: Partial<OnboardingFormState>) =>
    setFormState((prev) => ({ ...prev, ...patch }));

  return (
    <TwoFactorStep
      form={form}
      setForm={setForm}
      qrCode={qrCode}
      totpSecret={null}
      loadingQr={false}
      qrError={null}
      checkState={checkState}
      onVerifyCode={onVerifyCode}
    />
  );
}

describe("TwoFactorStep", () => {
  it("shows a loading message while the QR code is being generated", () => {
    render(
      <TwoFactorStep
        form={baseForm}
        setForm={vi.fn()}
        qrCode={null}
        totpSecret={null}
        loadingQr
        qrError={null}
        checkState="idle"
        onVerifyCode={vi.fn()}
      />,
    );

    expect(screen.getByText("Generating QR code…")).toBeInTheDocument();
  });

  it("shows an error when the QR code failed to load", () => {
    render(
      <TwoFactorStep
        form={baseForm}
        setForm={vi.fn()}
        qrCode={null}
        totpSecret={null}
        loadingQr={false}
        qrError="Could not generate QR code"
        checkState="idle"
        onVerifyCode={vi.fn()}
      />,
    );

    expect(screen.getByText("Could not generate QR code")).toBeInTheDocument();
  });

  it("renders the QR code image and manual key section", () => {
    render(
      <TwoFactorStep
        form={baseForm}
        setForm={vi.fn()}
        qrCode="data:image/png;base64,abc"
        totpSecret="ABCDEFGHIJKLMNOP"
        loadingQr={false}
        qrError={null}
        checkState="idle"
        onVerifyCode={vi.fn()}
      />,
    );

    expect(screen.getByAltText("TOTP QR code")).toHaveAttribute("src", "data:image/png;base64,abc");
    expect(screen.getByLabelText("Authenticator setup key")).toHaveValue("•".repeat(16));
  });

  it("toggles the manual key between masked and visible", async () => {
    render(
      <TwoFactorStep
        form={baseForm}
        setForm={vi.fn()}
        qrCode="data:image/png;base64,abc"
        totpSecret="ABCDEFGHIJKLMNOP"
        loadingQr={false}
        qrError={null}
        checkState="idle"
        onVerifyCode={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Show key" }));

    expect(screen.getByLabelText("Authenticator setup key")).toHaveValue("ABCDEFGHIJKLMNOP");
    expect(screen.getByRole("button", { name: "Hide key" })).toBeInTheDocument();
  });

  it("copies the manual key to the clipboard", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    render(
      <TwoFactorStep
        form={baseForm}
        setForm={vi.fn()}
        qrCode="data:image/png;base64,abc"
        totpSecret="ABCDEFGHIJKLMNOP"
        loadingQr={false}
        qrError={null}
        checkState="idle"
        onVerifyCode={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("ABCDEFGHIJKLMNOP");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it("only allows up to 6 digits in the confirmation code", async () => {
    render(<ControlledTwoFactorStep />);

    await userEvent.type(screen.getByPlaceholderText("000000"), "12a3456789");

    expect(screen.getByPlaceholderText("000000")).toHaveValue("123456");
  });

  it("disables verify until 6 digits are entered", async () => {
    render(<ControlledTwoFactorStep />);

    await userEvent.type(screen.getByPlaceholderText("000000"), "12345");

    expect(screen.getByRole("button", { name: "Verify code" })).toBeDisabled();
  });

  it("enables verify once 6 digits are entered and calls onVerifyCode", async () => {
    const onVerifyCode = vi.fn();
    render(<ControlledTwoFactorStep onVerifyCode={onVerifyCode} />);

    await userEvent.type(screen.getByPlaceholderText("000000"), "123456");

    const button = screen.getByRole("button", { name: "Verify code" });
    expect(button).toBeEnabled();

    await userEvent.click(button);

    expect(onVerifyCode).toHaveBeenCalledTimes(1);
  });

  it("disables verify when there is no QR code even with 6 digits entered", async () => {
    render(<ControlledTwoFactorStep qrCode={null} />);

    await userEvent.type(screen.getByPlaceholderText("000000"), "123456");

    expect(screen.getByRole("button", { name: "Verify code" })).toBeDisabled();
  });

  it("shows the checking state on the verify button and pill", () => {
    render(<ControlledTwoFactorStep checkState="checking" />);

    expect(screen.getByRole("button", { name: "Verifying…" })).toBeDisabled();
    expect(screen.getByText("Verifying…", { selector: "span" })).toBeInTheDocument();
  });

  it("shows the verified state with an authenticator-linked confirmation", () => {
    render(<ControlledTwoFactorStep checkState="ok" />);

    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Authenticator linked")).toBeInTheDocument();
  });

  it("shows the invalid-code state", () => {
    render(<ControlledTwoFactorStep checkState="error" />);

    expect(screen.getByText("Invalid code")).toBeInTheDocument();
  });
});
