import { expect } from "vitest";

/**
 * Asserts the row-action column is the only pinned column: the header cell labelled `label`
 * and the last cell of every body row carry `data-sticky-end`, and nothing else does. The table must sit
 * inside a `data-table-scroll` scroller (`TableWrap` or `useTableScrollEdges`), or the divider never shows.
 * Call from each table's row-render test so a missed or misplaced `sticky` prop fails.
 */
export function expectRowActionsPinned(table: HTMLElement, label = "Actions") {
  expect(table.closest("[data-table-scroll]")).not.toBeNull();

  const headerCells = Array.from(table.querySelectorAll("thead th"));
  const pinnedHeaders = headerCells.filter((cell) => cell.hasAttribute("data-sticky-end"));
  expect(pinnedHeaders.map((cell) => cell.textContent?.trim())).toEqual([label]);
  expect(headerCells[headerCells.length - 1]).toBe(pinnedHeaders[0]);

  const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
  expect(bodyRows.length).toBeGreaterThan(0);
  for (const row of bodyRows) {
    const cells = Array.from(row.children);
    const pinnedCells = cells.filter((cell) => cell.hasAttribute("data-sticky-end"));
    expect(pinnedCells).toEqual([cells[cells.length - 1]]);
  }
}
