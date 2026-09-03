import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChangelogEntry } from "../../../src/features/update/changelog";

const fetchChangelog = vi.fn();
const parseChangelog = vi.fn();

vi.mock("../../../src/features/update/changelog", () => ({
  fetchChangelog: (...args: unknown[]) => fetchChangelog(...args),
  parseChangelog: (...args: unknown[]) => parseChangelog(...args),
}));

import { ChangelogPreview } from "../../../src/features/update/ChangelogPreview";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ChangelogPreview", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state before the fetch resolves", () => {
    const pending = deferred<string>();
    fetchChangelog.mockReturnValue(pending.promise);

    render(<ChangelogPreview />);

    expect(screen.getByText("Loading changelog…")).toBeInTheDocument();
  });

  it("shows an error alert when the fetch fails", async () => {
    fetchChangelog.mockRejectedValue(new Error("network down"));

    render(<ChangelogPreview />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load changelog");
    expect(screen.getByText("Couldn't load the changelog from GitHub.")).toBeInTheDocument();
  });

  it("renders parsed entries with the first one open and later ones closed", async () => {
    const entries: ChangelogEntry[] = [
      { version: "[1.2.0] - 2026-08-20", categories: [{ name: "Added", items: ["New thing"] }] },
      { version: "[1.1.0] - 2026-08-10", categories: [{ name: "Fixed", items: ["Old bug"] }] },
    ];
    fetchChangelog.mockResolvedValue("raw markdown");
    parseChangelog.mockReturnValue(entries);

    const { container } = render(<ChangelogPreview />);

    expect(await screen.findByText("1.2.0")).toBeInTheDocument();
    expect(parseChangelog).toHaveBeenCalledWith("raw markdown");

    const detailsElements = container.querySelectorAll("details");
    expect(detailsElements).toHaveLength(2);
    expect(detailsElements[0]).toHaveAttribute("open");
    expect(detailsElements[1]).not.toHaveAttribute("open");

    expect(screen.getByText("- 2026-08-20")).toBeInTheDocument();
    expect(screen.getByText("Added")).toBeInTheDocument();
    expect(screen.getByText("New thing")).toBeInTheDocument();
  });

  it("renders inline code, bold, and link markdown within items", async () => {
    const entries: ChangelogEntry[] = [
      {
        version: "Unreleased",
        categories: [
          {
            name: "Added",
            items: [
              "Uses `getJson` under the hood",
              "**Important** change",
              "See [the docs](./docs/foo.md) and [GitHub](https://example.com/bar)",
            ],
          },
        ],
      },
    ];
    fetchChangelog.mockResolvedValue("raw markdown");
    parseChangelog.mockReturnValue(entries);

    render(<ChangelogPreview />);

    expect(await screen.findByText("Unreleased")).toBeInTheDocument();

    expect(screen.getByText("getJson").tagName).toBe("CODE");
    expect(screen.getByText("Important").tagName).toBe("STRONG");

    const internalLink = screen.getByRole("link", { name: "the docs" });
    expect(internalLink).toHaveAttribute(
      "href",
      "https://github.com/integritas-technology/edge-studio/blob/main/docs/foo.md",
    );
    expect(internalLink).toHaveAttribute("target", "_blank");

    const externalLink = screen.getByRole("link", { name: "GitHub" });
    expect(externalLink).toHaveAttribute("href", "https://example.com/bar");
  });

  it("renders a footer link to the full changelog on GitHub", async () => {
    fetchChangelog.mockResolvedValue("raw markdown");
    parseChangelog.mockReturnValue([]);

    render(<ChangelogPreview />);

    const link = await screen.findByRole("link", { name: "View full changelog on GitHub" });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/integritas-technology/edge-studio/blob/main/CHANGELOG.md",
    );
  });
});
