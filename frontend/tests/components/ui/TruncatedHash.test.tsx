import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TruncatedHash } from "../../../src/components/ui/TruncatedHash";

describe("TruncatedHash", () => {
  it("renders the short form of a long value", () => {
    const value = "Mx" + "a".repeat(40);
    render(<TruncatedHash value={value} />);
    expect(screen.getByText(`${value.slice(0, 8)}…${value.slice(-6)}`)).toBeInTheDocument();
  });

  it("sets the full value as the title attribute", () => {
    const value = "Mx" + "a".repeat(40);
    render(<TruncatedHash value={value} />);
    expect(screen.getByTitle(value)).toBeInTheDocument();
  });

  it("renders short values unchanged", () => {
    render(<TruncatedHash value="short" />);
    expect(screen.getByText("short")).toBeInTheDocument();
  });
});
