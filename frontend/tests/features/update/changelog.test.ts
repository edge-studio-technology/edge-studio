import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchChangelog, parseChangelog } from "../../../src/features/update/changelog";

describe("fetchChangelog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the changelog from GitHub without credentials and returns the text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve("# body") });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchChangelog();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/CHANGELOG.md",
    );
    expect(fetchMock.mock.calls[0]).toHaveLength(1);
    expect(result).toBe("# body");
  });

  it("throws with the HTTP status when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve("") });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchChangelog()).rejects.toThrow("GitHub returned HTTP 404");
  });
});

describe("parseChangelog", () => {
  it("parses versions, categories, and items", () => {
    const markdown = [
      "## [1.2.0] - 2026-08-20",
      "### Added",
      "- New thing",
      "- Another thing",
      "### Fixed",
      "- Bug fix",
    ].join("\n");

    const entries = parseChangelog(markdown);

    expect(entries).toEqual([
      {
        version: "[1.2.0] - 2026-08-20",
        categories: [
          { name: "Added", items: ["New thing", "Another thing"] },
          { name: "Fixed", items: ["Bug fix"] },
        ],
      },
    ]);
  });

  it("ignores content before the first version heading", () => {
    const markdown = ["preamble text", "- stray item", "## [1.0.0]", "### Added", "- Thing"].join("\n");

    const entries = parseChangelog(markdown);

    expect(entries).toEqual([{ version: "[1.0.0]", categories: [{ name: "Added", items: ["Thing"] }] }]);
  });

  it("ignores list items before any category heading", () => {
    const markdown = ["## [1.0.0]", "- orphan item", "### Added", "- Thing"].join("\n");

    const entries = parseChangelog(markdown);

    expect(entries).toEqual([{ version: "[1.0.0]", categories: [{ name: "Added", items: ["Thing"] }] }]);
  });

  it("defaults to a limit of 3 versions", () => {
    const markdown = ["## [4.0.0]", "## [3.0.0]", "## [2.0.0]", "## [1.0.0]"].join("\n");

    const entries = parseChangelog(markdown);

    expect(entries.map((entry) => entry.version)).toEqual(["[4.0.0]", "[3.0.0]", "[2.0.0]"]);
  });

  it("respects a custom limit", () => {
    const markdown = ["## [3.0.0]", "## [2.0.0]", "## [1.0.0]"].join("\n");

    const entries = parseChangelog(markdown, 1);

    expect(entries.map((entry) => entry.version)).toEqual(["[3.0.0]"]);
  });

  it("returns an empty array for markdown with no version headings", () => {
    expect(parseChangelog("just some text\n- an item")).toEqual([]);
  });
});
