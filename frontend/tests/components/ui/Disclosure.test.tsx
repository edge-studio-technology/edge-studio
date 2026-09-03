import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Disclosure } from "../../../src/components/ui/Disclosure";

describe("Disclosure", () => {
  it("renders open by default", () => {
    render(<Disclosure title="Section">Body</Disclosure>);
    expect(screen.getByText("Body")).toBeVisible();
  });

  it("respects defaultOpen=false", () => {
    const { container } = render(
      <Disclosure title="Section" defaultOpen={false}>
        Body
      </Disclosure>,
    );
    expect(container.querySelector("details")).not.toHaveAttribute("open");
  });

  it("toggles open state when the summary is clicked", async () => {
    const { container } = render(
      <Disclosure title="Section" defaultOpen={false}>
        Body
      </Disclosure>,
    );
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);

    await userEvent.click(screen.getByText("Section"));
    expect(details.open).toBe(true);
  });

  it("calls onToggle when toggled", async () => {
    const onToggle = vi.fn();
    render(
      <Disclosure title="Section" defaultOpen={false} onToggle={onToggle}>
        Body
      </Disclosure>,
    );

    await userEvent.click(screen.getByText("Section"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("honors a controlled open prop", () => {
    const { container, rerender } = render(
      <Disclosure title="Section" open={false}>
        Body
      </Disclosure>,
    );
    expect(container.querySelector("details")).not.toHaveAttribute("open");

    rerender(
      <Disclosure title="Section" open={true}>
        Body
      </Disclosure>,
    );
    expect(container.querySelector("details")).toHaveAttribute("open");
  });
});
