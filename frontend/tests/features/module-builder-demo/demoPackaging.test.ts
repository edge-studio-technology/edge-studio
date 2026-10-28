import { describe, expect, it } from "vitest";
import { demoDrafts, demoModules } from "../../../src/features/module-builder-demo/demoData";
import {
  demoDraftRevision,
  demoReleaseFiles,
  parseDemoDraft,
  validateDemoDraft,
} from "../../../src/features/module-builder-demo/demoPackaging";

describe("demo source and package hand-off", () => {
  const draft = demoDrafts[0];
  it("accepts the provided template without executing source", () => {
    expect(validateDemoDraft(draft)).toEqual([]);
  });
  it("blocks malformed manifest/configuration and missing entry files", () => {
    expect(
      validateDemoDraft({ ...draft, files: { ...draft.files, "module.json": "invalid" } }),
    ).not.toEqual([]);
    expect(
      validateDemoDraft({ ...draft, files: { ...draft.files, "schemas/config.json": "[]" } }),
    ).not.toEqual([]);
    const files = { ...draft.files };
    delete files["src/index.ts"];
    expect(validateDemoDraft({ ...draft, files })).toContain(
      "The manifest entry must point to an included source file.",
    );
    const manifest = JSON.parse(draft.files["module.json"]);
    expect(
      validateDemoDraft({
        ...draft,
        files: {
          ...draft.files,
          "module.json": JSON.stringify({ ...manifest, entry: "toString" }),
        },
      }),
    ).toContain("The manifest entry must point to an included source file.");
  });
  it("invalidates preparation when code, schema, or listing metadata changes", () => {
    const revision = demoDraftRevision(draft);
    expect(
      demoDraftRevision({ ...draft, files: { ...draft.files, "src/index.ts": "changed" } }),
    ).not.toBe(revision);
    expect(
      demoDraftRevision({ ...draft, files: { ...draft.files, "schemas/config.json": "{}" } }),
    ).not.toBe(revision);
    expect(demoDraftRevision({ ...draft, name: "Renamed" })).not.toBe(revision);
  });
  it("round-trips both exported snapshot kinds and preserves source as inert text", () => {
    for (const kind of ["source", "package"]) {
      const files = {
        ...draft.files,
        "src/index.ts": "throw new Error('never execute imported code')",
      };
      const restored = parseDemoDraft(
        JSON.stringify({ demo: true, kind, draft: { ...draft, files } }),
      );
      expect(restored.files).toEqual(files);
      expect(restored.id).toBe(draft.id);
    }
  });
  it("rejects device backups, receipts and malformed files as module imports", () => {
    for (const value of [
      { demo: true, kind: "device" },
      { demo: true, kind: "receipt" },
      { draft },
      { demo: true, draft: { ...draft, files: { "x.ts": 42 } } },
      { demo: true, draft: { ...draft, id: "broken/route" } },
    ])
      expect(() => parseDemoDraft(JSON.stringify(value))).toThrow();
  });
  it("returns the captured published source, rather than replacing it with a fixture", () => {
    const releaseFiles = { "module.json": "{}", "src/index.ts": "published source" };
    expect(demoReleaseFiles({ ...demoModules[0], releaseFiles })).toEqual(releaseFiles);
  });
  it("identifies seeded release fixtures with their actual displayed version", () => {
    const files = demoReleaseFiles({ ...demoModules[0], version: "2.0.0" });
    expect(JSON.parse(files["module.json"]).version).toBe("2.0.0");
    expect(files["src/index.ts"]).toContain("not the actual device implementation");
  });
});
