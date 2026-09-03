import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NoticeCard } from "../../../src/components/patterns/NoticeCard";

describe("NoticeCard", () => {
  it("renders title, children, and action", () => {
    render(<NoticeCard title="Update available" action={<button>Update</button>}>New version ready.</NoticeCard>);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Update available")).toBeInTheDocument();
    expect(screen.getByText("New version ready.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
  });

  it("does not render a dismiss button when onDismiss is not given", () => {
    render(<NoticeCard title="Update available" />);
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
  });

  it("calls onDismiss when the dismiss button is clicked", async () => {
    const onDismiss = vi.fn();
    render(<NoticeCard title="Update available" onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
