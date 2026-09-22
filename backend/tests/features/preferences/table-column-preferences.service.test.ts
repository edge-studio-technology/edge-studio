import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let service: typeof import("../../../src/features/preferences/table-column-preferences.service.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  service = await import("../../../src/features/preferences/table-column-preferences.service.js");
});

afterAll(() => {
  teardown();
});

describe("parseTableColumnPreferences", () => {
  it("keeps boolean column preferences and drops invalid values", () => {
    assert.deepEqual(
      service.parseTableColumnPreferences({
        devices: { name: true, details: false, invalid: "yes" },
        bad: "value",
      }),
      { devices: { visibility: { name: true, details: false }, order: [], filters: {} } },
    );
  });

  it("keeps visibility and order preferences and drops invalid values", () => {
    assert.deepEqual(
      service.parseTableColumnPreferences({
        devices: {
          visibility: { name: true, details: false, invalid: "yes" },
          order: ["details", "name", 123],
          filters: {
            name: { operator: "contains", value: "Button" },
            details: { operator: "not_contains", value: "" },
            bad: { operator: "bad", value: 123 },
          },
        },
      }),
      {
        devices: {
          visibility: { name: true, details: false },
          order: ["details", "name"],
          filters: { name: { operator: "contains", value: "Button" } },
        },
      },
    );
  });

  it("returns an empty object for non-object input", () => {
    assert.deepEqual(service.parseTableColumnPreferences(null), {});
    assert.deepEqual(service.parseTableColumnPreferences([]), {});
  });
});

describe("table column preferences storage", () => {
  it("saves and loads sanitized preferences", () => {
    const saved = service.saveTableColumnPreferences({
      workflows: {
        visibility: { name: true, enabled: false, count: 1 },
        order: ["enabled", "name"],
        filters: { name: { operator: "not_contains", value: "Archived" } },
      },
    });

    assert.deepEqual(saved, {
      workflows: {
        visibility: { name: true, enabled: false },
        order: ["enabled", "name"],
        filters: { name: { operator: "not_contains", value: "Archived" } },
      },
    });
    assert.deepEqual(service.getTableColumnPreferences(), {
      workflows: {
        visibility: { name: true, enabled: false },
        order: ["enabled", "name"],
        filters: { name: { operator: "not_contains", value: "Archived" } },
      },
    });
  });
});
