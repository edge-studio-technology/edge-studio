import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { IntegritasAuthStatus } from "../../../../src/features/integritas-auth/integritasAuthApi";
import { ConnectIntegritasStep } from "../../../../src/features/setup/steps/ConnectIntegritasStep";

const baseProps = {
  starting: false,
  error: null,
  onVerify: vi.fn(() => true),
  onRetry: vi.fn(),
  progressCurrent: 2,
  progressTotal: 2,
  canGoBack: false,
  onBack: vi.fn(),
};

afterEach(() => {
  vi.useRealTimers();
});

describe("ConnectIntegritasStep", () => {
  it("shows the ready state with a full connected profile", () => {
    const status: IntegritasAuthStatus = {
      status: "connected",
      user: { name: "Ada", email: "ada@example.com" },
      plan: { name: "Pro", status: "active" },
      usage: { remaining: 10 },
      fetchedAt: "2026-01-01T00:00:00Z",
    };

    render(<ConnectIntegritasStep {...baseProps} status={status} credentialType="pin" />);

    expect(screen.getByText("Edge Studio is ready")).toBeInTheDocument();
    expect(screen.getByText("Admin PIN set for this device")).toBeInTheDocument();
    expect(screen.getByText("Connected as ada@example.com")).toBeInTheDocument();
    expect(screen.queryByText("Two-factor auth")).not.toBeInTheDocument();
  });

  it("falls back to a generic connected message without a full profile", () => {
    const status: IntegritasAuthStatus = { status: "connected" };

    render(<ConnectIntegritasStep {...baseProps} status={status} credentialType="password" />);

    expect(screen.getByText("Admin password set for this device")).toBeInTheDocument();
    expect(screen.getByText("Connected to Integritas Connect")).toBeInTheDocument();
  });

  it("shows a generic device-secured detail when credentialType is not known (resume)", () => {
    const status: IntegritasAuthStatus = { status: "connected" };

    render(<ConnectIntegritasStep {...baseProps} status={status} credentialType={null} />);

    expect(screen.getByText("Device security enabled")).toBeInTheDocument();
  });

  it.each(["denied", "expired", "revoked"] as const)(
    "shows a terminal error and retry button for status %s",
    async (terminal) => {
      const onRetry = vi.fn();
      render(
        <ConnectIntegritasStep
          {...baseProps}
          onRetry={onRetry}
          status={{ status: terminal }}
        />,
      );

      expect(screen.getByText("Connect session failed")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    },
  );

  it("shows the connect steps while pending and not yet listening", () => {
    const status: IntegritasAuthStatus = {
      status: "pending",
      userCode: "ABC-123",
      verificationUrl: "https://connect.example.com/verify",
      expiresAt: "2026-01-01T00:20:00Z",
    };

    render(<ConnectIntegritasStep {...baseProps} status={status} />);

    expect(screen.getByRole("button", { name: "Open Integritas Connect" })).toBeInTheDocument();
    expect(screen.getByText("Log in or create an account")).toBeInTheDocument();
    expect(screen.getByText("Approve this device")).toBeInTheDocument();
  });

  it("switches to a listening state after opening the popup successfully", async () => {
    const onVerify = vi.fn(() => true);
    const status: IntegritasAuthStatus = {
      status: "pending",
      userCode: "ABC-123",
      verificationUrl: "https://connect.example.com/verify",
      expiresAt: "2026-01-01T00:20:00Z",
    };

    render(<ConnectIntegritasStep {...baseProps} status={status} onVerify={onVerify} />);

    await userEvent.click(screen.getByRole("button", { name: "Open Integritas Connect" }));

    expect(onVerify).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Listening for approval…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen Integritas Connect" })).toBeInTheDocument();
  });

  it("falls back to window.open when onVerify reports a blocked popup", async () => {
    const onVerify = vi.fn(() => false);
    const windowOpenSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const status: IntegritasAuthStatus = {
      status: "pending",
      userCode: "ABC-123",
      verificationUrl: "https://connect.example.com/verify",
      expiresAt: "2026-01-01T00:20:00Z",
    };

    render(<ConnectIntegritasStep {...baseProps} status={status} onVerify={onVerify} />);

    await userEvent.click(screen.getByRole("button", { name: "Open Integritas Connect" }));

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://connect.example.com/verify",
      "_blank",
      "noopener,noreferrer",
    );

    windowOpenSpy.mockRestore();
  });

  it("shows the pending error alongside the listening/steps UI", () => {
    const status: IntegritasAuthStatus = {
      status: "pending",
      userCode: "ABC-123",
      verificationUrl: "https://connect.example.com/verify",
      expiresAt: "2026-01-01T00:20:00Z",
    };

    render(<ConnectIntegritasStep {...baseProps} status={status} error="Network hiccup" />);

    expect(screen.getByText("Network hiccup")).toBeInTheDocument();
  });

  it("shows a start-failure error with a retry button when there is no status yet", async () => {
    const onRetry = vi.fn();
    render(
      <ConnectIntegritasStep {...baseProps} status={null} error="Failed to start" onRetry={onRetry} />,
    );

    expect(screen.getByText("Couldn't start Integritas Connect")).toBeInTheDocument();
    expect(screen.getByText("Failed to start")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the starting label on the retry button while starting", () => {
    render(
      <ConnectIntegritasStep {...baseProps} status={null} error="Failed to start" starting />,
    );

    expect(screen.getByRole("button", { name: "Starting…" })).toBeDisabled();
  });

  it("shows a preparing loader only after a short delay while waiting for status", () => {
    vi.useFakeTimers();

    render(<ConnectIntegritasStep {...baseProps} status={null} />);

    expect(screen.getByText("Preparing Integritas Connect…")).toBeInTheDocument();
    expect(screen.queryByText("Connecting to Integritas…")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText("Connecting to Integritas…")).toBeInTheDocument();
  });

  it("calls onBack when the back control is used", async () => {
    const onBack = vi.fn();
    render(
      <ConnectIntegritasStep
        {...baseProps}
        status={{
          status: "pending",
          userCode: "ABC-123",
          verificationUrl: "https://connect.example.com/verify",
          expiresAt: "2026-01-01T00:20:00Z",
        }}
        canGoBack
        onBack={onBack}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

/** `TOTP_ENABLED` ships as `false`, so the two-factor summary row only renders with the module mocked. */
describe("ConnectIntegritasStep with TOTP enabled", () => {
  let TotpConnectIntegritasStep: typeof ConnectIntegritasStep;

  beforeAll(async () => {
    vi.resetModules();
    vi.doMock("../../../../src/features/auth/totpEnabled", () => ({ TOTP_ENABLED: true }));
    ({ ConnectIntegritasStep: TotpConnectIntegritasStep } = await import(
      "../../../../src/features/setup/steps/ConnectIntegritasStep"
    ));
  });

  afterAll(() => {
    vi.doUnmock("../../../../src/features/auth/totpEnabled");
    vi.resetModules();
  });

  it("lists two-factor auth in the ready-state summary", () => {
    const status: IntegritasAuthStatus = {
      status: "connected",
      user: { name: "Ada", email: "ada@example.com" },
      plan: { name: "Pro", status: "active" },
      usage: { remaining: 10 },
      fetchedAt: "2026-01-01T00:00:00Z",
    };

    render(<TotpConnectIntegritasStep {...baseProps} status={status} credentialType="pin" />);

    expect(screen.getByText("Two-factor auth")).toBeInTheDocument();
    expect(screen.getByText("Authenticator ready for sign-in")).toBeInTheDocument();
  });
});
