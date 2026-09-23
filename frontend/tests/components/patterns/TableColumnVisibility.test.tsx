import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  activeColumnFilters,
  applyColumnFilters,
  orderedColumns,
  resolveColumnFilters,
  resolveColumnOrder,
  resolveColumnVisibility,
  TableColumnFilterSummary,
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

describe("orderedColumns", () => {
  it("returns known columns in the requested order", () => {
    expect(orderedColumns(columns, ["actions", "missing", "name"])).toEqual([
      columns[2],
      columns[0],
    ]);
  });
});

describe("resolveColumnFilters", () => {
  it("keeps only non-empty filters for filterable columns", () => {
    expect(
      resolveColumnFilters(
        [
          { id: "name", label: "Name", filterable: true },
          { id: "status", label: "Status", filterable: true },
          { id: "actions", label: "Actions" },
        ],
        {
          name: { operator: "not_contains", value: "  Test " },
          status: { operator: "contains", value: "   " },
          actions: { operator: "not_contains", value: "hidden" },
        },
      ),
    ).toEqual({ name: { operator: "not_contains", value: "Test" } });
  });
});

describe("activeColumnFilters", () => {
  it("returns active filters in column order", () => {
    expect(
      activeColumnFilters(columns, {
        status: { operator: "contains", value: "enabled" },
        name: { operator: "contains", value: "   " },
      }),
    ).toEqual([{ column: columns[1], filter: { operator: "contains", value: "enabled" } }]);
  });
});

describe("applyColumnFilters", () => {
  it("returns the original rows when no filters are active", () => {
    const rows = [{ name: "Button workflow" }];

    expect(applyColumnFilters(rows, {}, { name: (row) => row.name })).toBe(rows);
  });

  it("applies active filters with AND semantics", () => {
    const rows = [
      { name: "Button workflow", source: "Enabled sensor" },
      { name: "Button workflow", source: "Disabled sensor" },
      { name: "Camera workflow", source: "Enabled sensor" },
    ];

    expect(
      applyColumnFilters(
        rows,
        {
          name: { operator: "contains", value: "button" },
          source: { operator: "not_contains", value: "disabled" },
        },
        {
          name: (row) => row.name,
          source: (row) => row.source,
        },
      ),
    ).toEqual([{ name: "Button workflow", source: "Enabled sensor" }]);
  });

  it("treats missing accessor values as empty strings", () => {
    expect(
      applyColumnFilters(
        [{ name: "Button workflow" }],
        { missing: { operator: "not_contains", value: "button" } },
        {},
      ),
    ).toEqual([{ name: "Button workflow" }]);
  });
});

describe("TableColumnVisibilityButton", () => {
  it("does not open the modal when disabled", async () => {
    render(
      <TableColumnVisibilityButton
        tableLabel="Devices"
        columns={columns}
        visibility={{ name: true, status: true, actions: true }}
        onChange={vi.fn()}
        disabled
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose columns for Devices" }));

    expect(screen.queryByText("Changes are saved for this Edge Studio device.")).not.toBeInTheDocument();
  });

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

  it("closes the modal", async () => {
    render(
      <TableColumnVisibilityButton
        tableLabel="Devices"
        columns={columns}
        visibility={{ name: true, status: true, actions: true }}
        onChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose columns for Devices" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByText("Changes are saved for this Edge Studio device.")).not.toBeInTheDocument();
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

  it("does not move columns when ordering is disabled", async () => {
    render(
      <TableColumnVisibilityButton
        tableLabel="Devices"
        columns={columns}
        visibility={{ name: true, status: true, actions: true }}
        onChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose columns for Devices" }));

    expect(screen.getByRole("button", { name: "Move Status up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Status down" })).toBeDisabled();
  });

  it("clears the moved-column animation marker", async () => {
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

    await waitFor(() => expect(document.querySelector(".table-column-option-moved")).toBeInTheDocument());
    fireEvent.animationEnd(document.querySelector(".table-column-option-moved") as Element);

    expect(document.querySelector(".table-column-option-moved")).not.toBeInTheDocument();
  });

  it("opens a filter editor for filterable columns", async () => {
    const onFiltersChange = vi.fn();
    render(
      <TableColumnVisibilityButton
        tableLabel="Devices"
        columns={[{ id: "name", label: "Name", filterable: true }, { id: "actions", label: "Actions", dataColumn: false }]}
        visibility={{ name: true, actions: true }}
        filters={{}}
        onChange={vi.fn()}
        onFiltersChange={onFiltersChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose columns for Devices" }));
    await userEvent.click(screen.getByRole("button", { name: "Filter Name" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Text" }), {
      target: { value: "Button" },
    });

    expect(screen.queryByRole("button", { name: "Filter Actions" })).not.toBeInTheDocument();
    expect(onFiltersChange).toHaveBeenLastCalledWith({
      name: { operator: "contains", value: "Button" },
    });
  });

  it("updates and clears active filters", async () => {
    const onFiltersChange = vi.fn();
    render(
      <TableColumnVisibilityButton
        tableLabel="Devices"
        columns={[{ id: "name", label: "Name", filterable: true }]}
        visibility={{ name: true }}
        filters={{ name: { operator: "contains", value: "Button" } }}
        onChange={vi.fn()}
        onFiltersChange={onFiltersChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose columns for Devices" }));
    await userEvent.click(screen.getByRole("button", { name: "Filter Name" }));
    fireEvent.change(screen.getByLabelText("Rule"), { target: { value: "not_contains" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Text" }), { target: { value: "   " } });
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(onFiltersChange).toHaveBeenNthCalledWith(1, {
      name: { operator: "not_contains", value: "Button" },
    });
    expect(onFiltersChange).toHaveBeenNthCalledWith(2, {});
    expect(onFiltersChange).toHaveBeenNthCalledWith(3, {});
  });

  it("resets active filters with the default view", async () => {
    const onFiltersChange = vi.fn();
    render(
      <TableColumnVisibilityButton
        tableLabel="Devices"
        columns={columns}
        visibility={{ name: false, status: true, actions: true }}
        filters={{ name: { operator: "contains", value: "Button" } }}
        onChange={vi.fn()}
        onFiltersChange={onFiltersChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose columns for Devices" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset to default view" }));

    expect(onFiltersChange).toHaveBeenCalledWith({});
  });
});

describe("TableColumnFilterSummary", () => {
  it("renders nothing when no filters are active", () => {
    const { container } = render(
      <TableColumnFilterSummary columns={columns} filters={{}} onRemove={vi.fn()} onClear={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders active filters and remove actions", async () => {
    const onRemove = vi.fn();
    const onClear = vi.fn();
    render(
      <TableColumnFilterSummary
        columns={columns}
        filters={{
          name: { operator: "contains", value: "Button" },
          status: { operator: "not_contains", value: "disabled" },
        }}
        onRemove={onRemove}
        onClear={onClear}
      />,
    );

    expect(screen.getByText('Name contains "Button"')).toBeInTheDocument();
    expect(screen.getByText('Status does not contain "disabled"')).toBeInTheDocument();
    expect(screen.getByText("AND")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove Name filter" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear column filters" }));

    expect(onRemove).toHaveBeenCalledWith("name");
    expect(onClear).toHaveBeenCalled();
  });
});
