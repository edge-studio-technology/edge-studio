import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";

let rootDir: string;
let outsideDir: string;
let service: typeof import("../../../src/features/files/files.service.js");

beforeAll(async () => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "files-service-root-"));
  outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "files-service-outside-"));
  process.env.HOST_FILES_ROOT = rootDir;

  fs.writeFileSync(path.join(rootDir, "a-file.txt"), "hello");
  fs.writeFileSync(path.join(rootDir, "b-file.txt"), "world!!");
  fs.mkdirSync(path.join(rootDir, "a-dir"));
  fs.mkdirSync(path.join(rootDir, "z-dir"));
  fs.writeFileSync(path.join(rootDir, "a-dir", "nested.txt"), "x");
  fs.symlinkSync(outsideDir, path.join(rootDir, "escape-link"), "dir");
  fs.symlinkSync(path.join(rootDir, "a-dir"), path.join(rootDir, "inside-link"), "dir");

  service = await import("../../../src/features/files/files.service.js");
});

afterAll(() => {
  delete process.env.HOST_FILES_ROOT;
  fs.rmSync(rootDir, { recursive: true, force: true });
  fs.rmSync(outsideDir, { recursive: true, force: true });
});

describe("listFiles", () => {
  it("lists the root directory with directories before files before other entries, alphabetically within each group", async () => {
    const result = await service.listFiles("/");
    assert.equal(result.path, "/");
    assert.deepEqual(result.items.map((item) => [item.name, item.type]), [
      ["a-dir", "directory"],
      ["z-dir", "directory"],
      ["a-file.txt", "file"],
      ["b-file.txt", "file"],
      ["escape-link", "other"],
      ["inside-link", "other"]
    ]);
  });

  it("includes file sizes but not directory sizes", async () => {
    const result = await service.listFiles("/");
    const aFile = result.items.find((item) => item.name === "a-file.txt");
    const aDir = result.items.find((item) => item.name === "a-dir");
    assert.equal(aFile?.size, 5);
    assert.equal(aDir?.size, undefined);
  });

  it("lists a subdirectory and returns its normalized path", async () => {
    const result = await service.listFiles("/a-dir");
    assert.equal(result.path, "/a-dir");
    assert.deepEqual(result.items, [{ name: "nested.txt", type: "file", size: 1 }]);
  });

  it("normalizes a path without a leading slash", async () => {
    const result = await service.listFiles("a-dir");
    assert.equal(result.path, "/a-dir");
  });

  it("rejects a lexical path-traversal attempt outside the root", async () => {
    await assert.rejects(
      () => service.listFiles("/../../../etc"),
      (error: NodeJS.ErrnoException) => error.code === "OUTSIDE_ROOT"
    );
  });

  it("rejects a symlink that resolves outside the root", async () => {
    await assert.rejects(
      () => service.listFiles("/escape-link"),
      (error: NodeJS.ErrnoException) => error.code === "OUTSIDE_ROOT"
    );
  });

  it("follows a symlink that resolves inside the root", async () => {
    const result = await service.listFiles("/inside-link");
    assert.deepEqual(result.items, [{ name: "nested.txt", type: "file", size: 1 }]);
  });

  it("rejects a path that points at a file rather than a directory", async () => {
    await assert.rejects(
      () => service.listFiles("/a-file.txt"),
      (error: NodeJS.ErrnoException) => error.code === "NOT_DIRECTORY"
    );
  });

  it("propagates ENOENT for a path that does not exist", async () => {
    await assert.rejects(
      () => service.listFiles("/does-not-exist"),
      (error: NodeJS.ErrnoException) => error.code === "ENOENT"
    );
  });
});
