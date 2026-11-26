import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { blockConfigSnapshot, namedRunSnapshot, runSnapshot } from "../../../src/features/automation/automationRunSnapshots.js";

describe("workflow diagnostic snapshots", () => {
  it("records allowlisted settings and redacts parsed JSON without mutating execution inputs", () => {
    const secret = ["test", "credential"].join("-");
    const config = { variableName: "reading", variableSource: "custom_json", valueJsonText: JSON.stringify({ lux: 30, password: secret }), ignored: secret };
    const snapshot = blockConfigSnapshot("set_variable", config);
    assert.deepEqual(JSON.parse(String(snapshot.valueJsonText)), { lux: 30, password: "[redacted]" });
    assert.equal(JSON.stringify(snapshot).includes(secret), false);
    assert.equal(JSON.parse(config.valueJsonText).password, secret);
    assert.equal("ignored" in snapshot, false);
  });

  it("bounds oversized payloads and fails closed on invalid JSON", () => {
    assert.deepEqual(runSnapshot({ huge: "a".repeat(20000) }), { omitted: "Diagnostic value exceeds size limit", sizeBytes: 20011 });
    assert.equal(blockConfigSnapshot("set_variable", { valueJsonText: "{bad" }).valueJsonText, "[invalid JSON omitted]");
    assert.equal(typeof blockConfigSnapshot("show_preview", { title: "a".repeat(5000) }).title, "string");
  });

  it("redacts named scalar secrets and distinguishes missing from null", () => {
    assert.equal(namedRunSnapshot("password", "hidden"), "[redacted]");
    assert.equal(namedRunSnapshot("lux", null), null);
    assert.deepEqual(namedRunSnapshot("lux", undefined), { missing: true });
    assert.equal(blockConfigSnapshot("set_variable", { variableName: "apiKey", valueJsonText: '"hidden"' }).valueJsonText, '"[redacted]"');
    assert.equal(blockConfigSnapshot("if_payload_field_equals", { source: "variable", variableName: "password", value: "hidden" }).value, "[redacted]");
  });
});
