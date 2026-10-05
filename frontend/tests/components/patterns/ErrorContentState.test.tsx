import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorContentState } from "../../../src/components/patterns/ErrorContentState";

describe("ErrorContentState", () => {
  it("renders title, description, and detail", () => {
    render(
      <ErrorContentState
        title="Devices aren't available"
        description="Edge Studio couldn't reach the backend service."
        detail="HTTP 503"
      />,
    );

    expect(screen.getByText("Devices aren't available")).toBeInTheDocument();
    expect(screen.getByText("Edge Studio couldn't reach the backend service.")).toBeInTheDocument();
    expect(screen.getByText("HTTP 503")).toBeInTheDocument();
  });

  it("announces politely instead of interrupting like an alert", () => {
    render(<ErrorContentState title="Devices aren't available" />);

    const panel = screen.getByRole("status");
    expect(panel).toHaveAttribute("aria-live", "polite");
  });

  it("renders no retry button when onRetry is omitted", () => {
    render(<ErrorContentState title="Devices aren't available" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onRetry and supports a custom label", async () => {
    const onRetry = vi.fn();
    render(
      <ErrorContentState
        title="Devices aren't available"
        retryLabel="Try again"
        onRetry={onRetry}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("disables the retry button when retryDisabled is set", () => {
    render(<ErrorContentState title="Devices aren't available" onRetry={vi.fn()} retryDisabled />);
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
  });
});
