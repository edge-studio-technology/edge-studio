import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/components/ToastProvider";
import type { UseIntegritasAuthResult } from "../../src/features/integritas-auth/useIntegritasAuth";
import { IntegritasPage } from "../../src/pages/IntegritasPage";

const useIntegritasAuth = vi.hoisted(() => vi.fn());

vi.mock("../../src/features/integritas-auth/useIntegritasAuth", () => ({
  useIntegritasAuth: (...args: unknown[]) => useIntegritasAuth(...args),
}));

vi.mock("../../src/features/integritas-auth/IntegritasConnectPanel", () => ({
  IntegritasConnectPanel: () => null,
  statusLabel: {},
  statusTone: {},
}));

function authResult(overrides: Partial<UseIntegritasAuthResult> = {}): UseIntegritasAuthResult {
  return {
    status: null,
    loading: true,
    starting: false,
    error: null,
    notice: null,
    refresh: vi.fn(),
    start: vi.fn(),
    openVerification: vi.fn(),
    ...overrides,
  };
}

describe("IntegritasPage", () => {
  beforeEach(() => {
    useIntegritasAuth.mockReset();
  });

  it("shows an unavailable status instead of checking forever after the status load fails", () => {
    useIntegritasAuth.mockReturnValue(
      authResult({ loading: false, error: "Integritas status request failed" }),
    );

    render(<IntegritasPage />, { wrapper: ToastProvider });

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Checking…")).not.toBeInTheDocument();
  });
});
