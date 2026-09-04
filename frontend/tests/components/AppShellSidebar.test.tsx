import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppShellSidebar } from "../../src/components/AppShellSidebar";

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
});
