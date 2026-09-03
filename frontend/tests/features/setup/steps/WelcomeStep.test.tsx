import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { WelcomeStep } from "../../../../src/features/setup/steps/WelcomeStep";

describe("WelcomeStep", () => {
  it("lists the upcoming onboarding work steps (TOTP_ENABLED is currently false)", () => {
    render(<WelcomeStep onContinue={vi.fn()} />);

    expect(screen.getByText("Secure this device")).toBeInTheDocument();
    expect(screen.getByText("Integritas Connect")).toBeInTheDocument();
    expect(screen.getByText("Setup a local admin PIN or password for this device.")).toBeInTheDocument();
    expect(
      screen.getByText("Connect Integritas for data stamping and verification."),
    ).toBeInTheDocument();
  });

  it("does not list a two-factor auth step", () => {
    render(<WelcomeStep onContinue={vi.fn()} />);

    expect(screen.queryByText("Two-factor auth")).not.toBeInTheDocument();
  });

  it("calls onContinue when Get started is clicked", async () => {
    const onContinue = vi.fn();
    render(<WelcomeStep onContinue={onContinue} />);

    await userEvent.click(screen.getByRole("button", { name: "Get started" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

/** `TOTP_ENABLED` ships as `false`, so the two-factor copy is only rendered with the module mocked. */
describe("WelcomeStep with TOTP enabled", () => {
  let TotpWelcomeStep: typeof WelcomeStep;

  beforeAll(async () => {
    vi.resetModules();
    vi.doMock("../../../../src/features/auth/totpEnabled", () => ({ TOTP_ENABLED: true }));
    ({ WelcomeStep: TotpWelcomeStep } = await import(
      "../../../../src/features/setup/steps/WelcomeStep"
    ));
  });

  afterAll(() => {
    vi.doUnmock("../../../../src/features/auth/totpEnabled");
    vi.resetModules();
  });

  it("lists the two-factor auth step", () => {
    render(<TotpWelcomeStep onContinue={vi.fn()} />);

    expect(screen.getByText("Two-factor auth")).toBeInTheDocument();
    expect(
      screen.getByText("Setup an authenticator app for two-factor sign-in."),
    ).toBeInTheDocument();
  });

  it("mentions two-factor auth in the credentials step detail", () => {
    render(<TotpWelcomeStep onContinue={vi.fn()} />);

    expect(
      screen.getByText("Setup a local admin PIN or password, then two-factor auth."),
    ).toBeInTheDocument();
  });
});
