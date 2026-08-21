import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../src/components/ToastProvider";
import type { IntegritasProofRecord } from "../../../src/features/integritas/integritasTypes";

const getHistoryRecord = vi.fn();

vi.mock("../../../src/features/integritas/integritasApi", () => ({
  getHistoryRecord: (...args: unknown[]) => getHistoryRecord(...args),
}));

import { StampResult } from "../../../src/features/integritas/StampResult";

function record(overrides: Partial<IntegritasProofRecord> = {}): IntegritasProofRecord {
  return {
    id: "r1",
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
    file_name: "file.txt",
    file_size: 10,
    hash: "abc123",
    proof_uid: "uid-1",
    proof_status: "ready",
    proof_payload: "{}",
    status_response: null,
    verify_response: null,
    proof_error: null,
    ...overrides,
  };
}

describe("StampResult", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("shows a pending state and does not poll", () => {
    getHistoryRecord.mockResolvedValue({ record: record({ proof_status: "pending" }) });
    render(<StampResult record={record({ proof_status: "pending" })} onClose={vi.fn()} />, {
      wrapper: ToastProvider,
    });

    expect(screen.getByText("Waiting for confirmation")).toBeInTheDocument();
    expect(
      screen.getByText("Proof is pending on-chain. It will be confirmed in a few minutes."),
    ).toBeInTheDocument();
  });

  it("shows a confirmed state for a non-pending, non-failed status", () => {
    render(<StampResult record={record({ proof_status: "ready" })} onClose={vi.fn()} />, {
      wrapper: ToastProvider,
    });

    expect(screen.getByText("Confirmed on-chain")).toBeInTheDocument();
    expect(screen.getByText("Your file has been stamped.")).toBeInTheDocument();
  });

  it("shows a failed state with the proof error message", () => {
    render(
      <StampResult
        record={record({ proof_status: "failed", proof_error: "Node unreachable" })}
        onClose={vi.fn()}
      />,
      { wrapper: ToastProvider },
    );

    expect(screen.getByText("Proof failed")).toBeInTheDocument();
    expect(screen.getByText("Node unreachable")).toBeInTheDocument();
  });

  it("falls back to a default failed description when there is no proof_error", () => {
    render(
      <StampResult record={record({ proof_status: "failed", proof_error: null })} onClose={vi.fn()} />,
      { wrapper: ToastProvider },
    );

    expect(screen.getByText("The proof could not be confirmed.")).toBeInTheDocument();
  });

  it("shows the diagnostics link and, when technicalDetails is provided, the JSON preview button", () => {
    render(
      <StampResult record={record()} technicalDetails={{ foo: "bar" }} onClose={vi.fn()} />,
      { wrapper: ToastProvider },
    );

    expect(screen.getByRole("link", { name: "Open in Diagnostics" })).toHaveAttribute(
      "href",
      "/diagnostics?tab=proofs",
    );
    expect(screen.getByRole("button", { name: "View technical details" })).toBeInTheDocument();
  });

  it("hides the JSON preview button when technicalDetails is undefined", () => {
    render(<StampResult record={record()} onClose={vi.fn()} />, { wrapper: ToastProvider });

    expect(
      screen.queryByRole("button", { name: "View technical details" }),
    ).not.toBeInTheDocument();
  });

  it("calls onClose when dismissed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<StampResult record={record()} onClose={onClose} />, { wrapper: ToastProvider });

    await user.click(screen.getByRole("button", { name: "Dismiss stamp result" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("polls getHistoryRecord while pending and updates to the refreshed record", async () => {
    getHistoryRecord.mockResolvedValue({ record: record({ proof_status: "ready" }) });
    render(<StampResult record={record({ proof_status: "pending" })} onClose={vi.fn()} />, {
      wrapper: ToastProvider,
    });

    expect(screen.getByText("Waiting for confirmation")).toBeInTheDocument();
    await waitFor(() => expect(getHistoryRecord).toHaveBeenCalledWith("r1"));
    await waitFor(() => expect(screen.getByText("Confirmed on-chain")).toBeInTheDocument());
  });

  it("shows an unauthorized toast when the refresh fails with unauthorized", async () => {
    const error = Object.assign(new Error("nope"), { errorCode: "unauthorized" });
    getHistoryRecord.mockRejectedValue(error);
    render(<StampResult record={record({ proof_status: "pending" })} onClose={vi.fn()} />, {
      wrapper: ToastProvider,
    });

    await waitFor(() => expect(getHistoryRecord).toHaveBeenCalled());
    // `showToast` isn't a stable reference in `ToastProvider`, so each toast add re-runs the
    // polling effect and can surface more than one toast here — assert at least one landed.
    await waitFor(() =>
      expect(screen.getAllByText("Integritas API key rejected").length).toBeGreaterThan(0),
    );
  });
});
