import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../src/components/ToastProvider";
import { StampFilePanel } from "../../../src/features/integritas/StampFilePanel";
import type { IntegritasProofRecord } from "../../../src/features/integritas/integritasTypes";

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
    verification_report_file: overrides.verification_report_file ?? null,
  };
}

function renderPanel(props: Partial<React.ComponentProps<typeof StampFilePanel>> = {}) {
  return render(
    <StampFilePanel
      file={null}
      setFile={vi.fn()}
      busy={false}
      onStamp={vi.fn()}
      resultRecord={null}
      resultDetails={undefined}
      onClearResult={vi.fn()}
      {...props}
    />,
    { wrapper: ToastProvider },
  );
}

describe("StampFilePanel", () => {
  it("renders the file drop box and a disabled stamp button when no file is selected", () => {
    renderPanel();

    expect(screen.getByText("Upload a local data file")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stamp file" })).toBeDisabled();
  });

  it("enables the stamp button once a file is selected and calls onStamp", async () => {
    const user = userEvent.setup();
    const onStamp = vi.fn();
    const file = new File(["data"], "data.txt");
    renderPanel({ file, onStamp });

    const button = screen.getByRole("button", { name: "Stamp file" });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onStamp).toHaveBeenCalledOnce();
  });

  it("disables the stamp button while busy even with a file selected", () => {
    const file = new File(["data"], "data.txt");
    renderPanel({ file, busy: true });

    expect(screen.getByRole("button", { name: "Stamp file" })).toBeDisabled();
  });

  it("does not show a stamp result when resultRecord is null", () => {
    renderPanel();
    expect(screen.queryByLabelText("Stamp result")).not.toBeInTheDocument();
  });

  it("shows the stamp result and forwards resultDetails and onClearResult", async () => {
    const user = userEvent.setup();
    const onClearResult = vi.fn();
    renderPanel({
      resultRecord: record({ proof_status: "ready" }),
      resultDetails: { some: "detail" },
      onClearResult,
    });

    expect(screen.getByLabelText("Stamp result")).toBeInTheDocument();
    expect(screen.getByText("Confirmed on-chain")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View technical details" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss stamp result" }));
    expect(onClearResult).toHaveBeenCalledOnce();
  });
});
