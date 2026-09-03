import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ListPaginationFooter } from "../../../src/components/patterns/ListPaginationFooter";

describe("ListPaginationFooter", () => {
  it("renders the range label and page size select", () => {
    render(
      <ListPaginationFooter
        page={2}
        pageSize={10}
        total={25}
        totalPages={3}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        pageSizeOptions={[
          { value: "10", label: "10" },
          { value: "25", label: "25" },
        ]}
      />,
    );

    expect(screen.getByText("Showing 11–20 of 25")).toBeInTheDocument();
    expect(screen.getByLabelText("Rows")).toHaveValue("10");
  });

  it("calls onPageSizeChange with a number when the select changes", async () => {
    const onPageSizeChange = vi.fn();
    render(
      <ListPaginationFooter
        page={1}
        pageSize={10}
        total={25}
        totalPages={3}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[
          { value: "10", label: "10" },
          { value: "25", label: "25" },
        ]}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Rows"), "25");
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });
});
