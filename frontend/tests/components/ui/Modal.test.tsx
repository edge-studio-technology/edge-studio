import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "../../../src/components/ui/Modal";

describe("Modal", () => {
  it("renders the title, description, and children", () => {
    render(
      <Modal title="Delete item" description="This cannot be undone" onClose={vi.fn()}>
        Body content
      </Modal>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete item")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(<Modal title="Title" onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on Escape key by default", async () => {
    const onClose = vi.fn();
    render(<Modal title="Title" onClose={onClose} />);

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose on Escape when closeDisabled", async () => {
    const onClose = vi.fn();
    render(<Modal title="Title" onClose={onClose} closeDisabled />);

    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  });

  it("renders footer content", () => {
    render(<Modal title="Title" onClose={vi.fn()} footer={<button>Confirm</button>} />);
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });
});
