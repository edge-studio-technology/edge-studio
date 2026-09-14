import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, IconButton, LinkButton } from "../../../src/components/ui/Button";

describe("Button", () => {
  it("renders children and calls onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    await userEvent.click(button);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("defaults to type=button", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("renders iconStart and iconEnd alongside children", () => {
    render(
      <Button iconStart={<span data-testid="start" />} iconEnd={<span data-testid="end" />}>
        Save
      </Button>,
    );

    expect(screen.getByTestId("start")).toBeInTheDocument();
    expect(screen.getByTestId("end")).toBeInTheDocument();
  });

  it("is disabled when disabled is passed", () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

describe("LinkButton", () => {
  it("renders as an anchor with the given href", () => {
    render(<LinkButton href="/download">Download</LinkButton>);
    const link = screen.getByRole("link", { name: "Download" });
    expect(link).toHaveAttribute("href", "/download");
  });
});

describe("IconButton", () => {
  it("renders with the given aria-label and calls onClick", async () => {
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Close" onClick={onClick}>
        <span data-testid="icon" />
      </IconButton>,
    );

    const button = screen.getByRole("button", { name: "Close" });
    expect(screen.getByTestId("icon")).toBeInTheDocument();

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
