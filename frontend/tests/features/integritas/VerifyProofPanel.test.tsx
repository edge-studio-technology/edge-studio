import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../src/components/ToastProvider";
import { VerifyProofPanel } from "../../../src/features/integritas/VerifyProofPanel";

function renderPanel(props: Partial<React.ComponentProps<typeof VerifyProofPanel>> = {}) {
  return render(
    <VerifyProofPanel
      file={null}
      setFile={vi.fn()}
      busy={false}
      loading={false}
      onVerifyFile={vi.fn()}
      result={null}
      onClearResult={vi.fn()}
      {...props}
    />,
    { wrapper: ToastProvider },
  );
}

describe("VerifyProofPanel", () => {
  it("renders the file drop box and a disabled verify button when no file is selected", () => {
    renderPanel();

    expect(screen.getByText("Upload a JSON proof file")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify proof" })).toBeDisabled();
  });

  it("enables the verify button once a file is selected and calls onVerifyFile", async () => {
    const user = userEvent.setup();
    const onVerifyFile = vi.fn();
    const file = new File(["{}"], "proof.json");
    renderPanel({ file, onVerifyFile });

    const button = screen.getByRole("button", { name: "Verify proof" });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onVerifyFile).toHaveBeenCalledOnce();
  });

  it("disables the verify button while busy", () => {
    const file = new File(["{}"], "proof.json");
    renderPanel({ file, busy: true });

    expect(screen.getByRole("button", { name: "Verify proof" })).toBeDisabled();
  });

  it("shows a loading state and hides the result while loading", () => {
    renderPanel({ loading: true, result: { response: {} } });

    expect(screen.getByText("Verifying your proof")).toBeInTheDocument();
    expect(screen.queryByLabelText("Verify result")).not.toBeInTheDocument();
  });

  it("shows nothing below the button when not loading and there is no result", () => {
    renderPanel();
    expect(screen.queryByText("Verifying your proof")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Verify result")).not.toBeInTheDocument();
  });

  it("shows the verify result and forwards onClearResult", async () => {
    const user = userEvent.setup();
    const onClearResult = vi.fn();
    const response = { data: { verification: { data: { result: "full match" } } } };
    renderPanel({ result: { response }, onClearResult });

    expect(screen.getByLabelText("Verify result")).toBeInTheDocument();
    expect(screen.getByText("Full match")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss verify result" }));
    expect(onClearResult).toHaveBeenCalledOnce();
  });
});
