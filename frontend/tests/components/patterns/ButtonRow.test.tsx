import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ButtonRow } from "../../../src/components/patterns/ButtonRow";

describe("ButtonRow", () => {
  it("renders children", () => {
    render(
      <ButtonRow>
        <button>One</button>
        <button>Two</button>
      </ButtonRow>,
    );

    expect(screen.getByRole("button", { name: "One" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Two" })).toBeInTheDocument();
  });

  it("merges a custom className", () => {
    render(
      <ButtonRow className="custom-class">
        <button>One</button>
      </ButtonRow>,
    );

    expect(screen.getByRole("button", { name: "One" }).parentElement).toHaveClass("custom-class");
  });
});
