import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteConfirmModal, DeleteProgressModal } from "../../../src/components/patterns/DeleteConfirmModal";

describe("DeleteConfirmModal", () => {
  it("renders the item label and default description", () => {
    render(
      <DeleteConfirmModal
        title="Delete source"
        itemLabel="My Source"
        confirmLabel="Delete"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText("Delete My Source?")).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
  });

  it("calls onCancel and onConfirm from the respective buttons", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmModal
        title="Delete source"
        itemLabel="My Source"
        confirmLabel="Delete"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe("DeleteProgressModal", () => {
  it("renders the title and description with a disabled close", () => {
    render(<DeleteProgressModal title="Deleting" description="Please wait" />);

    expect(screen.getByText("Deleting in progress")).toBeInTheDocument();
    expect(screen.getByText("Please wait")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  });
});
