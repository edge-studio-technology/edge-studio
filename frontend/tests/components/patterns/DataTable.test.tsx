import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  DataTable,
  EmptyTableState,
  RowActions,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableIconMenu,
  TableRow,
  TableWrap,
} from "../../../src/components/patterns/DataTable";

describe("DataTable", () => {
  it("renders a table with header and body rows", () => {
    render(
      <TableWrap>
        <DataTable>
          <TableHead>
            <TableHeaderCell>Name</TableHeaderCell>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Alice</TableCell>
            </TableRow>
          </TableBody>
        </DataTable>
      </TableWrap>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Alice" })).toBeInTheDocument();
  });
});

describe("TableCard", () => {
  it("renders title, description, actions, and children", () => {
    render(
      <TableCard title="Users" description="All users" actions={<button>Add</button>}>
        <p>Body content</p>
      </TableCard>,
    );

    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByText("All users")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });
});

describe("EmptyTableState", () => {
  it("renders children", () => {
    render(<EmptyTableState>No rows yet.</EmptyTableState>);
    expect(screen.getByText("No rows yet.")).toBeInTheDocument();
  });
});

describe("RowActions", () => {
  it("renders children", () => {
    render(
      <RowActions>
        <button>Edit</button>
      </RowActions>,
    );
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });
});

describe("TableIconMenu", () => {
  it("opens the menu, runs the clicked item's onClick, and closes", async () => {
    const onClick = vi.fn();
    render(
      <TableIconMenu
        items={[{ label: "Delete", onClick }]}
      />,
    );

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("disables an item marked disabled", async () => {
    render(<TableIconMenu items={[{ label: "Delete", onClick: vi.fn(), disabled: true }]} />);

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeDisabled();
  });
});
