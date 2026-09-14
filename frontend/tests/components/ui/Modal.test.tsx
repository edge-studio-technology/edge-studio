import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Modal } from "../../../src/components/ui/Modal";
import { closeModalOnOutsideClickSetting } from "../../../src/lib/behaviourSettings";

beforeEach(() => {
  closeModalOnOutsideClickSetting.set(true);
});

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

  it("closes only when a press lands directly on the backdrop", () => {
    const onClose = vi.fn();
    render(<Modal title="Title" onClose={onClose}>Content</Modal>);
    const backdrop = document.body.querySelector<HTMLElement>('[role="presentation"]');
    if (!backdrop) throw new Error("backdrop not found");
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close from the backdrop when outside-click closing is disabled", () => {
    closeModalOnOutsideClickSetting.set(false);
    const onClose = vi.fn();
    render(<Modal title="Title" onClose={onClose} />);
    const backdrop = document.body.querySelector<HTMLElement>('[role="presentation"]');
    if (!backdrop) throw new Error("backdrop not found");
    fireEvent.mouseDown(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close from the backdrop when closeDisabled", () => {
    const onClose = vi.fn();
    render(<Modal title="Title" onClose={onClose} closeDisabled />);
    const backdrop = document.body.querySelector<HTMLElement>('[role="presentation"]');
    if (!backdrop) throw new Error("backdrop not found");
    fireEvent.mouseDown(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps scrolling locked until the final nested modal unmounts", () => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "scroll";
    const first = render(<Modal title="First" onClose={vi.fn()} />);
    const second = render(<Modal title="Second" onClose={vi.fn()} />);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    first.unmount();
    expect(document.body.style.overflow).toBe("hidden");
    second.unmount();
    expect(document.documentElement.style.overflow).toBe("auto");
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("pads and restores the app-shell scrollbar while open", () => {
    const mainScroll = document.createElement("main");
    mainScroll.className = "app-shell-main-scroll";
    mainScroll.style.overflow = "auto";
    mainScroll.style.paddingRight = "3px";
    Object.defineProperty(mainScroll, "offsetWidth", { configurable: true, value: 120 });
    Object.defineProperty(mainScroll, "clientWidth", { configurable: true, value: 100 });
    document.body.appendChild(mainScroll);
    const view = render(<Modal title="Title" onClose={vi.fn()} />);
    expect(mainScroll.style.overflow).toBe("hidden");
    expect(mainScroll.style.paddingRight).toBe("20px");
    view.unmount();
    expect(mainScroll.style.overflow).toBe("auto");
    expect(mainScroll.style.paddingRight).toBe("3px");
    mainScroll.remove();
  });

  it("renders footer content", () => {
    render(<Modal title="Title" onClose={vi.fn()} footer={<button>Confirm</button>} />);
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });
});
