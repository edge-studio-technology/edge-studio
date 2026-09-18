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
      { devices: { name: true, details: false } },
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
      workflows: { name: true, enabled: false, count: 1 },
    });

    assert.deepEqual(saved, { workflows: { name: true, enabled: false } });
    assert.deepEqual(service.getTableColumnPreferences(), {
      workflows: { name: true, enabled: false },
    });
  });
});
