import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TableControls } from "../../../src/components/patterns/TableControls";

describe("TableControls", () => {
  it("renders toolbar content and utility controls together", () => {
    render(
      <TableControls utilities={<button type="button">Choose columns</button>}>
        <label>
          Search
          <input type="search" />
        </label>
      </TableControls>,
    );

    expect(screen.getByRole("searchbox", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose columns" })).toBeInTheDocument();
  });

  it("renders only utilities for tables without filters", () => {
    render(<TableControls utilities={<button type="button">Choose columns</button>} />);

    expect(screen.getByRole("button", { name: "Choose columns" })).toBeInTheDocument();
  });
});
