import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  resolveColumnOrder,
  resolveColumnVisibility,
  TableColumnVisibilityButton,
  visibleColumnIds,
  type TableColumnDefinition,
} from "../../../src/components/patterns/TableColumnVisibility";

const columns = [
  { id: "name", label: "Name" },
  { id: "status", label: "Status" },
  { id: "actions", label: "Actions", dataColumn: false },
] as const satisfies readonly TableColumnDefinition[];

describe("resolveColumnVisibility", () => {
  it("uses saved values when present and column defaults otherwise", () => {
    expect(
      resolveColumnVisibility(
        [
          { id: "name", label: "Name" },
          { id: "status", label: "Status", defaultVisible: false },
        ],
        { name: false },
      ),
    ).toEqual({ name: false, status: false });
  });
});

describe("visibleColumnIds", () => {
  it("returns visible columns in definition order", () => {
    expect(visibleColumnIds(columns, { name: true, status: false, actions: true })).toEqual([
      "name",
      "actions",
    ]);
  });
});

describe("resolveColumnOrder", () => {
  it("keeps saved known columns first and appends new columns in definition order", () => {
    expect(resolveColumnOrder(columns, ["status", "missing", "name"])).toEqual([
      "status",
      "name",
      "actions",
    ]);
  });
});

describe("TableColumnVisibilityButton", () => {
  it("opens a modal and toggles a data column", async () => {
    const onChange = vi.fn();
    render(
      <TableColumnVisibilityButton
        tableLabel="Devices"
        columns={columns}
        visibility={{ name: true, status: true, actions: true }}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose columns for Devices" }));
    await userEvent.click(screen.getByRole("switch", { name: "Status" }));

    expect(onChange).toHaveBeenCalledWith({ name: true, status: false, actions: true });
  });

  it("allows action columns to be hidden", async () => {
    const onChange = vi.fn();
    render(
      <TableColumnVisibilityButton
        tableLabel="Devices"
        columns={columns}
        visibility={{ name: true, status: false, actions: true }}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose columns for Devices" }));
    await userEvent.click(screen.getByRole("switch", { name: "Actions" }));

    expect(onChange).toHaveBeenCalledWith({ name: true, status: false, actions: false });
  });

  it("prevents hiding the last visible data column", async () => {
    const onChange = vi.fn();
    render(
      <TableColumnVisibilityButton
        tableLabel="Devices"
        columns={columns}
        visibility={{ name: true, status: false, actions: true }}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose columns for Devices" }));

    expect(screen.getByRole("switch", { name: "Name" })).toBeDisabled();
    expect(screen.getByText("At least one data column must stay visible.")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("resets columns to their default visibility", async () => {
    const onChange = vi.fn();
    const onOrderChange = vi.fn();
    const columnsWithHiddenDefault = [
      ...columns,
      { id: "created", label: "Created", defaultVisible: false },
    ] as const satisfies readonly TableColumnDefinition[];
    render(
      <TableColumnVisibilityButton
        tableLabel="Devices"
        columns={columnsWithHiddenDefault}
        visibility={{ name: false, status: true, actions: false, created: true }}
        columnOrder={["created", "actions", "status", "name"]}
        onChange={onChange}
        onOrderChange={onOrderChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose columns for Devices" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset to default view" }));

    expect(onChange).toHaveBeenCalledWith({
      name: true,
      status: true,
      actions: true,
      created: false,
    });
    expect(onOrderChange).toHaveBeenCalledWith(["name", "status", "actions", "created"]);
  });

  it("moves columns up and down", async () => {
    const onOrderChange = vi.fn();
    render(
      <TableColumnVisibilityButton
        tableLabel="Devices"
        columns={columns}
        visibility={{ name: true, status: true, actions: true }}
        columnOrder={["name", "status", "actions"]}
        onChange={vi.fn()}
        onOrderChange={onOrderChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose columns for Devices" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Status up" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Status down" }));

    expect(onOrderChange).toHaveBeenNthCalledWith(1, ["status", "name", "actions"]);
    expect(onOrderChange).toHaveBeenNthCalledWith(2, ["name", "actions", "status"]);
  });
});
