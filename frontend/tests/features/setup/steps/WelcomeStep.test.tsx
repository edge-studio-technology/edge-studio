import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
