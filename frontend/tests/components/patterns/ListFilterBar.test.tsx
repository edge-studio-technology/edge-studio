import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ListFilterBar } from "../../../src/components/patterns/ListFilterBar";

describe("ListFilterBar", () => {
  it("renders the search input with the given value", () => {
    render(<ListFilterBar q="hello" onQueryChange={vi.fn()} />);
    expect(screen.getByLabelText("Search")).toHaveValue("hello");
  });

  it("does not render the filter select without filterOptions/onFilterChange", () => {
    render(<ListFilterBar q="" onQueryChange={vi.fn()} />);
    expect(screen.queryByLabelText("Filter")).not.toBeInTheDocument();
  });

  it("calls onFilterChange immediately when the filter select changes", async () => {
    const onFilterChange = vi.fn();
    render(
      <ListFilterBar
        q=""
        filter="all"
        filterOptions={[
          { value: "all", label: "All" },
          { value: "active", label: "Active" },
        ]}
        onFilterChange={onFilterChange}
        onQueryChange={vi.fn()}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Filter"), "active");
    expect(onFilterChange).toHaveBeenCalledWith("active");
  });

  it("debounces onQueryChange after typing", async () => {
    const onQueryChange = vi.fn();
    render(<ListFilterBar q="" onQueryChange={onQueryChange} />);

    await userEvent.type(screen.getByLabelText("Search"), "abc");
    expect(onQueryChange).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenCalledWith("abc");
    });
  });
});
