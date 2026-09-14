import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

/**
 * `TOTP_ENABLED` ships as `false`, so the wizard's two-factor step — and with it the deferred
 * local-admin creation, which moves from the credentials step to the two-factor step — is only
 * reachable with the module mocked.
 */
describe("OnboardingWizard with TOTP enabled", () => {
  let TotpOnboardingWizard: typeof OnboardingWizard;

  beforeAll(async () => {
    vi.resetModules();
    vi.doMock("../../../src/features/auth/totpEnabled", () => ({ TOTP_ENABLED: true }));
    ({ OnboardingWizard: TotpOnboardingWizard } = await import(
      "../../../src/features/setup/OnboardingWizard"
    ));
  });

  beforeEach(() => {
    initTotp.mockReset();
    verifyTotp.mockReset();
    completeSetup.mockReset();
    start.mockReset();
    openVerification.mockReset().mockReturnValue(true);
    useIntegritasAuthMock.mockReset();
    mockHook();
  });

  afterAll(() => {
    vi.doUnmock("../../../src/features/auth/totpEnabled");
    vi.resetModules();
  });

  async function advanceToTwoFactorStep() {
    render(<TotpOnboardingWizard onComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Get started" }));
    await fillMatchingPin();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  }

  it("requests a QR code on the two-factor step without creating the local admin yet", async () => {
    initTotp.mockResolvedValue({ qrCodePngBase64: "data:image/png;base64,QR", secret: "SECRET123" });

    await advanceToTwoFactorStep();

    expect(await screen.findByText("Set up two-factor authentication")).toBeInTheDocument();
    await waitFor(() => {
      expect(initTotp).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByAltText("TOTP QR code")).toHaveAttribute("src", "data:image/png;base64,QR");
    expect(completeSetup).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Show key" }));
    expect(screen.getByLabelText("Authenticator setup key")).toHaveValue("SECRET123");
  });

  // A failing `initTotp` also retries without a backoff or attempt limit — the effect's guard
  // reads `qrCode`/`loadingQr` but not `qrError`, so the error it sets is cleared by the next
  // run. Deliberately not asserted here; recorded in `docs/plans/high-risk-business-logic-hardening.md`.
  it("keeps continue disabled when the QR code cannot be generated", async () => {
    initTotp.mockRejectedValue(new Error("Could not reach the setup service"));

    await advanceToTwoFactorStep();

    expect(await screen.findByText("Set up two-factor authentication")).toBeInTheDocument();
    await waitFor(() => {
      expect(initTotp).toHaveBeenCalled();
    });
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("keeps continue disabled until the entered code is verified", async () => {
    initTotp.mockResolvedValue({ qrCodePngBase64: "data:image/png;base64,QR", secret: "SECRET123" });
    verifyTotp.mockResolvedValue({ valid: true });

    await advanceToTwoFactorStep();
    await screen.findByAltText("TOTP QR code");

    expect(screen.getByText("Not verified")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Confirmation code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify code" }));

    await waitFor(() => {
      expect(verifyTotp).toHaveBeenCalledWith("123456");
    });
    expect(await screen.findByText("Authenticator linked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("reports an invalid code when verification is rejected", async () => {
    initTotp.mockResolvedValue({ qrCodePngBase64: "data:image/png;base64,QR", secret: "SECRET123" });
    verifyTotp.mockRejectedValue(new Error("Invalid TOTP code"));

    await advanceToTwoFactorStep();
    await screen.findByAltText("TOTP QR code");

    await userEvent.type(screen.getByLabelText("Confirmation code"), "111111");
    await userEvent.click(screen.getByRole("button", { name: "Verify code" }));

    expect(await screen.findByText("Invalid code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("creates the local admin from the two-factor step and advances to Integritas Connect", async () => {
    initTotp.mockResolvedValue({ qrCodePngBase64: "data:image/png;base64,QR", secret: "SECRET123" });
    verifyTotp.mockResolvedValue({ valid: true });
    completeSetup.mockResolvedValue({ success: true, user: {} });
    mockHook({ status: { status: "unauthenticated" } });

    await advanceToTwoFactorStep();
    await screen.findByAltText("TOTP QR code");

    await userEvent.type(screen.getByLabelText("Confirmation code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify code" }));
    await screen.findByText("Authenticator linked");

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(completeSetup).toHaveBeenCalledWith({ password: "123456" });
    });
    expect(await screen.findByText("Connect your Integritas account")).toBeInTheDocument();
  });
});
