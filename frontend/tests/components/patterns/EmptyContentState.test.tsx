import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyContentState } from "../../../src/components/patterns/EmptyContentState";

describe("EmptyContentState", () => {
  it("renders title and description", () => {
    render(<EmptyContentState title="No sources yet" description="Add one to get started." />);

    expect(screen.getByText("No sources yet")).toBeInTheDocument();
    expect(screen.getByText("Add one to get started.")).toBeInTheDocument();
  });

  it("renders no action buttons when none are given", () => {
    render(<EmptyContentState title="No sources yet" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders primary and secondary actions and calls their handlers", async () => {
    const onAction = vi.fn();
    const onSecondaryAction = vi.fn();
    render(
      <EmptyContentState
        title="No sources yet"
        actionLabel="Add source"
        onAction={onAction}
        secondaryActionLabel="Learn more"
        onSecondaryAction={onSecondaryAction}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Add source" }));
    expect(onAction).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: "Learn more" }));
    expect(onSecondaryAction).toHaveBeenCalledOnce();
  });

  it("disables the primary action when actionDisabled is set", () => {
    render(
      <EmptyContentState title="No sources yet" actionLabel="Add source" onAction={vi.fn()} actionDisabled />,
    );
    expect(screen.getByRole("button", { name: "Add source" })).toBeDisabled();
  });
});
