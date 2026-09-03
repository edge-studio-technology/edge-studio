import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { formatBytes } from "../../src/shared/format.js";

describe("formatBytes", () => {
  it("returns null for undefined input", () => {
    assert.equal(formatBytes(undefined), null);
  });

  it("formats bytes below 1 KB", () => {
    assert.equal(formatBytes(512), "512 B");
  });

  it("formats kilobytes", () => {
    assert.equal(formatBytes(1024), "1.0 KB");
    assert.equal(formatBytes(1536), "1.5 KB");
  });

  it("formats megabytes", () => {
    assert.equal(formatBytes(1024 * 1024), "1.0 MB");
  });

  it("formats gigabytes", () => {
    assert.equal(formatBytes(1024 * 1024 * 1024), "1.0 GB");
    assert.equal(formatBytes(2.5 * 1024 * 1024 * 1024), "2.5 GB");
  });

  it("formats zero as bytes", () => {
    assert.equal(formatBytes(0), "0 B");
  });
});
