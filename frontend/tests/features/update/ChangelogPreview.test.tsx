import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChangelogPreview } from "../../../src/features/update/ChangelogPreview";

const markdown = [
  "## [Unreleased] task/next",
  "### Added",
  "- Not released yet",
  "## [1.3.0] - 2026-08-30",
  "### Added",
  "- Newest thing",
  "## [1.2.0] - 2026-08-20",
  "### Fixed",
  "- Middle fix",
  "## [1.1.0] - 2026-08-10",
  "### Changed",
  "- Older change",
  "## [1.0.0] - 2026-08-01",
  "### Added",
  "- First release",
].join("\n");

describe("ChangelogPreview", () => {
  it("shows a retryable error state when no changelog is cached", async () => {
    const onRetry = vi.fn();

    render(<ChangelogPreview markdown={null} onRetry={onRetry} />);

    expect(screen.getByText("Release notes aren't available")).toBeInTheDocument();
    expect(screen.getByText("The update service hasn't downloaded the changelog yet.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("previews the latest 3 released entries with the first one open", () => {
    const { container } = render(<ChangelogPreview markdown={markdown} onRetry={vi.fn()} />);

    expect(screen.getByText("1.3.0")).toBeInTheDocument();
    expect(screen.getByText("1.2.0")).toBeInTheDocument();
    expect(screen.getByText("1.1.0")).toBeInTheDocument();
    expect(screen.queryByText("1.0.0")).not.toBeInTheDocument();
    expect(screen.queryByText("Not released yet")).not.toBeInTheDocument();

    const detailsElements = container.querySelectorAll("details");
    expect(detailsElements).toHaveLength(3);
    expect(detailsElements[0]).toHaveAttribute("open");
    expect(detailsElements[1]).not.toHaveAttribute("open");

    expect(screen.getByText("- 2026-08-30")).toBeInTheDocument();
    expect(screen.getByText("Newest thing")).toBeInTheDocument();
  });

  it("opens every released entry in the full changelog view and closes it again", async () => {
    render(<ChangelogPreview markdown={markdown} onRetry={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "View full changelog" }));

    const dialog = screen.getByRole("dialog", { name: "Changelog" });
    for (const version of ["1.3.0", "1.2.0", "1.1.0", "1.0.0"]) {
      expect(within(dialog).getByText(version)).toBeInTheDocument();
    }
    expect(within(dialog).queryByText("Not released yet")).not.toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders inline code, bold, and link markdown within items", () => {
    const inline = [
      "## [1.0.0]",
      "### Added",
      "- Uses `getJson` under the hood",
      "- **Important** change",
      "- See [the docs](./docs/foo.md) and [GitHub](https://example.com/bar)",
    ].join("\n");

    render(<ChangelogPreview markdown={inline} onRetry={vi.fn()} />);

    expect(screen.getByText("getJson").tagName).toBe("CODE");
    expect(screen.getByText("Important").tagName).toBe("STRONG");

    const internalLink = screen.getByRole("link", { name: "the docs" });
    expect(internalLink).toHaveAttribute(
      "href",
      "https://github.com/edge-studio-technology/edge-studio/blob/main/docs/foo.md",
    );
    expect(internalLink).toHaveAttribute("target", "_blank");

    const externalLink = screen.getByRole("link", { name: "GitHub" });
    expect(externalLink).toHaveAttribute("href", "https://example.com/bar");
  });
});
