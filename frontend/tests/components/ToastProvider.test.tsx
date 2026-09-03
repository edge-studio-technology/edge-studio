import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "../../src/components/ToastProvider";

function ShowToastButton(props: {
  title: string;
  message?: string;
  tone?: "error" | "success" | "info" | "warning";
  timeoutMs?: number;
}) {
  const { showToast } = useToast();
  return <button onClick={() => showToast(props)}>Trigger</button>;
}

describe("ToastProvider / useToast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws when useToast is called outside a ToastProvider", () => {
    expect(() => renderHook(() => useToast())).toThrow(
      "useToast must be used inside ToastProvider",
    );
  });

  it("shows a toast with title and message after showToast is called", async () => {
    render(
      <ToastProvider>
        <ShowToastButton title="Saved" message="Your changes were saved." />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Trigger" }));

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Your changes were saved.")).toBeInTheDocument();
  });

  it("dismisses a toast when its close button is clicked", async () => {
    render(
      <ToastProvider>
        <ShowToastButton title="Saved" />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Trigger" }));
    expect(screen.getByText("Saved")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close notification" }));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("auto-dismisses a toast after its timeout elapses", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ShowToastButton title="Saved" timeoutMs={1000} />
      </ToastProvider>,
    );

    act(() => {
      screen.getByRole("button", { name: "Trigger" }).click();
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("pauses auto-dismiss while hovered and resumes it on mouse leave", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ShowToastButton title="Saved" timeoutMs={1000} />
      </ToastProvider>,
    );

    act(() => {
      screen.getByRole("button", { name: "Trigger" }).click();
    });

    const card = screen.getByRole("status").firstElementChild as HTMLElement;

    fireEvent.mouseEnter(card);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // Still present: the dismiss timer was paused while hovered.
    expect(screen.getByText("Saved")).toBeInTheDocument();

    fireEvent.mouseLeave(card);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });
});
