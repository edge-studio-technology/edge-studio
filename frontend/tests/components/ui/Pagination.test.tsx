import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pagination, PaginationNumber } from "../../../src/components/ui/Pagination";

describe("PaginationNumber", () => {
  it("renders a non-interactive current page indicator", () => {
    render(<PaginationNumber number={2} state="Current" />);
    expect(screen.getByText("2")).toHaveAttribute("aria-current", "page");
  });

  it("renders a clickable default page button", async () => {
    const onClick = vi.fn();
    render(<PaginationNumber number={3} onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Go to page 3" });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled when no onClick is given", () => {
    render(<PaginationNumber number={4} />);
    expect(screen.getByRole("button", { name: "Go to page 4" })).toBeDisabled();
  });
});

describe("Pagination", () => {
  it("renders all page numbers when totalPages is small", () => {
    render(<Pagination page={1} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("condenses with an ellipsis for many pages", () => {
    render(<Pagination page={5} totalPages={20} onPageChange={vi.fn()} />);
    expect(screen.getAllByText("...").length).toBeGreaterThan(0);
  });

  it("disables Previous on the first page", () => {
    render(<Pagination page={1} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
  });

  it("disables Next on the last page", () => {
    render(<Pagination page={5} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("calls onPageChange with the next page when Next is clicked", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={5} onPageChange={onPageChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("calls onPageChange with the previous page when Previous is clicked", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={5} onPageChange={onPageChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("disables all controls when disabled is set", () => {
    render(<Pagination page={2} totalPages={5} onPageChange={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });
});
