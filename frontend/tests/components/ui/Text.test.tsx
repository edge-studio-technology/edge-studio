import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Text } from "../../../src/components/ui/Text";

describe("Text", () => {
  it("Title renders an h2", () => {
    render(<Text.Title>Heading</Text.Title>);
    expect(screen.getByRole("heading", { level: 2, name: "Heading" })).toBeInTheDocument();
  });

  it("Subtitle renders text content", () => {
    render(<Text.Subtitle>Subheading</Text.Subtitle>);
    expect(screen.getByText("Subheading")).toBeInTheDocument();
  });

  it("Body renders text content", () => {
    render(<Text.Body>Body copy</Text.Body>);
    expect(screen.getByText("Body copy")).toBeInTheDocument();
  });

  it("BodyEm renders text content", () => {
    render(<Text.BodyEm>Emphasized</Text.BodyEm>);
    expect(screen.getByText("Emphasized")).toBeInTheDocument();
  });

  it("Muted renders text content", () => {
    render(<Text.Muted>Muted copy</Text.Muted>);
    expect(screen.getByText("Muted copy")).toBeInTheDocument();
  });

  it("Link renders a router link with the given href", () => {
    render(
      <MemoryRouter>
        <Text.Link to="/settings">Settings</Text.Link>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });
});
