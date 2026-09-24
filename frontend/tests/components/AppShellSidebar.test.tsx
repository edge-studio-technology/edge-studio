import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { AppShellSidebar, EXPAND_MQ } from "../../src/components/AppShellSidebar";
import { nav } from "../../src/app/nav";

// happy-dom's default viewport (1024px wide) matches the sidebar's `(min-width: 1024px)`
// expand breakpoint and the "start collapsed" setting defaults to false, so the sidebar
// renders expanded by default in this test environment.
function renderSidebar(props?: Partial<ComponentProps<typeof AppShellSidebar>>) {
  return render(
    <MemoryRouter>
      <AppShellSidebar
        pathname="/dashboard"
        onFeedback={vi.fn()}
        onSignOut={vi.fn()}
        version="1.2.3"
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("AppShellSidebar", () => {
  it("renders the nav items as links", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: /Dashboard/ })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /Wallet/ })).toHaveAttribute("href", "/wallet");
    expect(screen.getByRole("link", { name: /Settings/ })).toHaveAttribute("href", "/settings");
  });

  it("shows the version string", () => {
    renderSidebar({ version: "1.2.3" });
    expect(screen.getByText("1.2.3")).toBeInTheDocument();
  });

  it("falls back to 'Unknown version' when version is null", () => {
    renderSidebar({ version: null });
    expect(screen.getByText("Unknown version")).toBeInTheDocument();
  });

  it("calls onFeedback when the feedback button is clicked", async () => {
    const onFeedback = vi.fn();
    renderSidebar({ onFeedback });
    await userEvent.click(screen.getByRole("button", { name: "Feedback" }));
    expect(onFeedback).toHaveBeenCalledOnce();
  });

  it("toggles the collapsed state when the collapse/expand button is clicked", async () => {
    renderSidebar();
    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });

  it("renders an update notice node when given", () => {
    renderSidebar({ updateNotice: <p>Update available</p> });
    expect(screen.getByText("Update available")).toBeInTheDocument();
  });

  describe("below 1024", () => {
    afterEach(() => vi.unstubAllGlobals());

    function stubNarrow() {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
      );
    }

    function expandNarrow(props?: Partial<ComponentProps<typeof AppShellSidebar>>) {
      stubNarrow();
      const view = renderSidebar(props);
      fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
      return view;
    }

    it("keeps an accessible name on every nav link when collapsed", () => {
      stubNarrow();
      renderSidebar();
      for (const item of nav) {
        const href = `/${item.id}`;
        const link = screen
          .getAllByRole("link")
          .find((el) => el.getAttribute("href") === href);
        expect(link, href).toHaveAccessibleName(new RegExp(item.label));
      }
    });

    it("starts collapsed with no overlay", () => {
      stubNarrow();
      const { container } = renderSidebar();
      expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
      expect(container.querySelector("aside")).not.toHaveAttribute("data-overlay");
    });

    it("overlays the page when expanded", () => {
      const { container } = expandNarrow();
      expect(container.querySelector("aside")).toHaveAttribute("data-overlay", "true");
      expect(screen.getByTestId("sidebar-backdrop")).toBeInTheDocument();
    });

    it("collapses on Escape", () => {
      expandNarrow();
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
    });

    it("collapses on a click outside", () => {
      expandNarrow();
      fireEvent.click(screen.getByTestId("sidebar-backdrop"));
      expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
    });

    it("collapses on navigation", () => {
      const { rerender } = expandNarrow();
      rerender(
        <MemoryRouter>
          <AppShellSidebar
            pathname="/wallet"
            onFeedback={vi.fn()}
            onSignOut={vi.fn()}
            version="1.2.3"
          />
        </MemoryRouter>,
      );
      expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
      expect(screen.queryByTestId("sidebar-backdrop")).not.toBeInTheDocument();
    });
  });

  it("starts expanded at 1024 and above", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    const { container } = renderSidebar();
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
    expect(container.querySelector("aside")).not.toHaveAttribute("data-overlay");
    vi.unstubAllGlobals();
  });

  it("expands at Tailwind's lg breakpoint so JS and CSS switch at the same width", () => {
    const pattern = /--breakpoint-lg:\s*([\d.]+)rem/;
    const appCss = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");
    const themeCss = readFileSync(
      createRequire(join(process.cwd(), "package.json")).resolve("tailwindcss/theme.css"),
      "utf8",
    );
    const rem = Number((appCss.match(pattern) ?? themeCss.match(pattern))?.[1]);
    expect(EXPAND_MQ).toBe(`(min-width: ${rem * 16}px)`);
  });
});
