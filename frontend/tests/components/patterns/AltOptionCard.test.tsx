import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AltOptionCard } from "../../../src/components/patterns/AltOptionCard";

describe("AltOptionCard", () => {
  it("renders title, description, and action, and calls onClick", async () => {
    const onClick = vi.fn();
    render(
      <AltOptionCard title="Title" description="Description" actionLabel="Go" onClick={onClick} />,
    );

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disables the action button when disabled is passed", () => {
    render(<AltOptionCard title="Title" actionLabel="Go" onClick={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: "Go" })).toBeDisabled();
  });
});
