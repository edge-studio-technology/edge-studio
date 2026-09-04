import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
}));

import { IntegritasConnectPanel } from "../../../src/features/integritas-auth/IntegritasConnectPanel";
import type { UseIntegritasAuthResult } from "../../../src/features/integritas-auth/useIntegritasAuth";
import type { IntegritasAuthStatus } from "../../../src/features/integritas-auth/integritasAuthApi";

function makeAuth(overrides: Partial<UseIntegritasAuthResult> = {}): UseIntegritasAuthResult {
  return {
    status: null,
    loading: false,
    starting: false,
    error: null,
    notice: null,
    refresh: vi.fn(),
    start: vi.fn(),
    openVerification: vi.fn().mockReturnValue(true),
    ...overrides,
  };
}

describe("IntegritasConnectPanel", () => {
  beforeEach(() => {
    getJson.mockReset();
    getJson.mockResolvedValue({ portalUrl: null });
    vi.stubGlobal("open", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a heading when not bare", () => {
    render(<IntegritasConnectPanel auth={makeAuth()} />);
    expect(screen.getByText("Integritas Connect")).toBeInTheDocument();
  });

  it("hides the heading when bare", () => {
    render(<IntegritasConnectPanel bare auth={makeAuth()} />);
    expect(screen.queryByText("Integritas Connect")).not.toBeInTheDocument();
  });

  it("shows a checking indicator while loading with no status yet", () => {
    render(<IntegritasConnectPanel auth={makeAuth({ loading: true, status: null })} />);
    expect(screen.getByText("Checking connection…")).toBeInTheDocument();
  });

  it("shows an error message when present", () => {
    render(<IntegritasConnectPanel auth={makeAuth({ error: "Failed to load Integritas status" })} />);
    expect(screen.getByText("Failed to load Integritas status")).toBeInTheDocument();
  });

  it("shows a notice when present and there is no error", () => {
    render(<IntegritasConnectPanel auth={makeAuth({ notice: "Showing last saved profile" })} />);
    expect(screen.getByText("Showing last saved profile")).toBeInTheDocument();
  });

  it("hides the notice when an error is also present", () => {
    render(
      <IntegritasConnectPanel
        auth={makeAuth({ notice: "Showing last saved profile", error: "boom" })}
      />,
    );
    expect(screen.queryByText("Showing last saved profile")).not.toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  describe("unauthenticated", () => {
    it("shows a connect button that starts activation with a popup", async () => {
      const start = vi.fn();
      render(
        <IntegritasConnectPanel auth={makeAuth({ status: { status: "unauthenticated" }, start })} />,
      );

      expect(
        screen.getByText("Edge Studio is not connected to your Integritas Connect account."),
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: /Connect account/ }));
      expect(start).toHaveBeenCalledWith({ openPopup: true });
    });

    it("disables the button and shows Starting… while starting", () => {
      render(
        <IntegritasConnectPanel
          auth={makeAuth({ status: { status: "unauthenticated" }, starting: true })}
        />,
      );

      const button = screen.getByRole("button", { name: /Starting…/ });
      expect(button).toBeDisabled();
    });
  });

  describe("pending", () => {
    const pendingStatus: IntegritasAuthStatus = {
      status: "pending",
      userCode: "ABC-123",
      verificationUrl: "https://connect.example/verify",
      expiresAt: "2026-01-01",
    };

    it("uses openVerification when it succeeds, without falling back to window.open", async () => {
      const openVerification = vi.fn().mockReturnValue(true);
      render(<IntegritasConnectPanel auth={makeAuth({ status: pendingStatus, openVerification })} />);

      expect(screen.getByText(/Approve the pending request/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Connect account" }));

      expect(openVerification).toHaveBeenCalled();
      expect(window.open).not.toHaveBeenCalled();
    });

    it("falls back to window.open when openVerification fails", async () => {
      const openVerification = vi.fn().mockReturnValue(false);
      render(<IntegritasConnectPanel auth={makeAuth({ status: pendingStatus, openVerification })} />);

      await userEvent.click(screen.getByRole("button", { name: "Connect account" }));

      expect(window.open).toHaveBeenCalledWith(
        "https://connect.example/verify",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  describe("connected", () => {
    it("renders profile details when the full profile is present", () => {
      const status: IntegritasAuthStatus = {
        status: "connected",
        user: { name: "Ada Lovelace", email: "ada@example.com" },
        plan: { name: "Pro", status: "active" },
        usage: { remaining: 1234 },
        fetchedAt: "2026-01-01",
      };
      render(<IntegritasConnectPanel auth={makeAuth({ status })} />);

      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
      expect(screen.getByText("ada@example.com")).toBeInTheDocument();
      expect(screen.getByText("Pro")).toBeInTheDocument();
      expect(screen.getByText("(active)")).toBeInTheDocument();
      expect(screen.getByText((text) => text.replace(/\D/g, "") === "1234")).toBeInTheDocument();
    });

    it("omits the plan status parenthetical when plan status is empty", () => {
      const status: IntegritasAuthStatus = {
        status: "connected",
        user: { name: "Ada Lovelace", email: "ada@example.com" },
        plan: { name: "Pro", status: "" },
        usage: { remaining: 1 },
        fetchedAt: "2026-01-01",
      };
      render(<IntegritasConnectPanel auth={makeAuth({ status })} />);

      expect(screen.getByText("Pro")).toBeInTheDocument();
      expect(screen.queryByText("(active)")).not.toBeInTheDocument();
    });

    it("shows a placeholder message when profile fields are missing", () => {
      const status: IntegritasAuthStatus = { status: "connected" };
      render(<IntegritasConnectPanel auth={makeAuth({ status })} />);

      expect(
        screen.getByText("Connected. Profile details will appear when Connect is reachable."),
      ).toBeInTheDocument();
    });

    it("shows an unlink hint", () => {
      const status: IntegritasAuthStatus = { status: "connected" };
      render(<IntegritasConnectPanel auth={makeAuth({ status })} />);

      expect(
        screen.getByText("To unlink, revoke this Edge Studio from your Integritas Connect account."),
      ).toBeInTheDocument();
    });

    it("shows a portal button when the portal url loads, and opens it on click", async () => {
      getJson.mockResolvedValue({ portalUrl: "https://portal.example" });
      const status: IntegritasAuthStatus = { status: "connected" };
      render(<IntegritasConnectPanel auth={makeAuth({ status })} />);

      const button = await screen.findByRole("button", { name: /Open Integritas portal/ });
      await userEvent.click(button);

      expect(window.open).toHaveBeenCalledWith("https://portal.example", "_blank", "noopener,noreferrer");
    });

    it("does not show a portal button when the config fetch fails", async () => {
      getJson.mockRejectedValue(new Error("network down"));
      const status: IntegritasAuthStatus = { status: "connected" };
      render(<IntegritasConnectPanel auth={makeAuth({ status })} />);

      await screen.findByText("To unlink, revoke this Edge Studio from your Integritas Connect account.");
      expect(screen.queryByRole("button", { name: /Open Integritas portal/ })).not.toBeInTheDocument();
    });
  });

  describe("terminal states", () => {
    it.each([
      ["denied", "Activation was denied in Integritas Connect."],
      ["expired", "The verification code expired."],
      ["revoked", "This device was revoked in Integritas Connect."],
    ] as const)("shows the %s message and a re-connect button", async (kind, message) => {
      const start = vi.fn();
      render(<IntegritasConnectPanel auth={makeAuth({ status: { status: kind }, start })} />);

      expect(screen.getByText(new RegExp(message))).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: /Connect account/ }));
      expect(start).toHaveBeenCalledWith({ openPopup: true });
    });

    it("shows Starting… and disables the button while starting", () => {
      render(<IntegritasConnectPanel auth={makeAuth({ status: { status: "denied" }, starting: true })} />);
      const button = screen.getByRole("button", { name: /Starting…/ });
      expect(button).toBeDisabled();
    });
  });
});
