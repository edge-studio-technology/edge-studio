import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UseIntegritasAuthResult } from "../../../src/features/integritas-auth/useIntegritasAuth";
import { OnboardingWizard } from "../../../src/features/setup/OnboardingWizard";

const initTotp = vi.fn();
const verifyTotp = vi.fn();
const completeSetup = vi.fn();

vi.mock("../../../src/features/setup/api", () => ({
  initTotp: (...args: unknown[]) => initTotp(...args),
  verifyTotp: (...args: unknown[]) => verifyTotp(...args),
  completeSetup: (...args: unknown[]) => completeSetup(...args),
}));

const start = vi.fn();
const openVerification = vi.fn(() => true);
const useIntegritasAuthMock = vi.fn();

vi.mock("../../../src/features/integritas-auth/useIntegritasAuth", () => ({
  useIntegritasAuth: (...args: unknown[]) => useIntegritasAuthMock(...args),
}));

function mockHook(overrides: Partial<UseIntegritasAuthResult> = {}) {
  useIntegritasAuthMock.mockReturnValue({
    status: null,
    loading: false,
    starting: false,
    error: null,
    notice: null,
    refresh: vi.fn(),
    start,
    openVerification,
    ...overrides,
  });
}

async function fillMatchingPin(pin = "123456") {
  await userEvent.type(screen.getByLabelText("PIN"), pin);
  await userEvent.type(screen.getByLabelText("Confirm PIN"), pin);
}

describe("OnboardingWizard", () => {
  beforeEach(() => {
    initTotp.mockReset();
    verifyTotp.mockReset();
    completeSetup.mockReset();
    start.mockReset();
    openVerification.mockReset().mockReturnValue(true);
    useIntegritasAuthMock.mockReset();
    mockHook();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts on the welcome step and advances to credentials on Get started", async () => {
    render(<OnboardingWizard onComplete={vi.fn()} />);

    expect(screen.getByText("Setup guide")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Get started" }));

    expect(screen.getByText("Choose PIN or password")).toBeInTheDocument();
  });

  it("creates the local admin on credentials submit and advances to Integritas Connect", async () => {
    completeSetup.mockResolvedValue({ success: true, user: {} });
    mockHook({ status: { status: "unauthenticated" } });

    render(<OnboardingWizard onComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Get started" }));

    await fillMatchingPin();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(completeSetup).toHaveBeenCalledWith({ password: "123456" });
    });
    await waitFor(() => {
      expect(screen.getByText("Connect your Integritas account")).toBeInTheDocument();
    });
  });

  it("shows a submit error and stays on the credentials step when completeSetup fails", async () => {
    completeSetup.mockRejectedValue(new Error("Setup failed on server"));

    render(<OnboardingWizard onComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Get started" }));
    await fillMatchingPin();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(screen.getByText("Setup failed on server")).toBeInTheDocument();
    });
    expect(screen.getByText("Choose PIN or password")).toBeInTheDocument();
  });

  it("automatically starts Integritas Connect once the local admin exists and status is unauthenticated", async () => {
    completeSetup.mockResolvedValue({ success: true, user: {} });
    mockHook({ status: { status: "unauthenticated" } });

    render(<OnboardingWizard onComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Get started" }));
    await fillMatchingPin();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(start).toHaveBeenCalledTimes(1);
    });
    expect(start).toHaveBeenCalledWith();
  });

  it("calls onComplete when Enter Edge Studio is pressed once connected (resumeAtConnect)", async () => {
    mockHook({
      status: {
        status: "connected",
        user: { name: "Ada", email: "ada@example.com" },
        plan: { name: "Pro", status: "active" },
        usage: { remaining: 10 },
        fetchedAt: "2026-01-01T00:00:00Z",
      },
    });
    const onComplete = vi.fn();

    render(<OnboardingWizard onComplete={onComplete} resumeAtConnect />);

    expect(screen.getByText("Edge Studio is ready")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Enter Edge Studio" });
    expect(button).toBeEnabled();

    await userEvent.click(button);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("does not show a back control on resume since the local admin already exists", () => {
    mockHook({ status: { status: "pending", userCode: "A", verificationUrl: "https://x", expiresAt: "2026-01-01T00:00:00Z" } });

    render(<OnboardingWizard onComplete={vi.fn()} resumeAtConnect />);

    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("retries Integritas Connect with a popup when Try again is pressed after a terminal status", async () => {
    mockHook({ status: { status: "denied" } });

    render(<OnboardingWizard onComplete={vi.fn()} resumeAtConnect />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(start).toHaveBeenCalledWith({ openPopup: true });
  });

  it("sets body overflow to hidden while mounted and restores it on unmount", () => {
    document.body.style.overflow = "auto";

    const { unmount } = render(<OnboardingWizard onComplete={vi.fn()} />);
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });
});
