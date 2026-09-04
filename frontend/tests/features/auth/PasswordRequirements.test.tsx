import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordRequirements } from "../../../src/features/auth/PasswordRequirements";

describe("PasswordRequirements", () => {
  it("marks every requirement as not met for an empty password", () => {
    render(<PasswordRequirements password="" />);

    expect(screen.getByLabelText("8 + characters: not met")).toBeInTheDocument();
    expect(screen.getByLabelText("Uppercase: not met")).toBeInTheDocument();
    expect(screen.getByLabelText("Lowercase: not met")).toBeInTheDocument();
    expect(screen.getByLabelText("Number: not met")).toBeInTheDocument();
    expect(screen.getByLabelText("Symbol: not met")).toBeInTheDocument();
  });

  it("marks every requirement as met for a fully compliant password", () => {
    render(<PasswordRequirements password="Abcdef1!" />);

    expect(screen.getByLabelText("8 + characters: met")).toBeInTheDocument();
    expect(screen.getByLabelText("Uppercase: met")).toBeInTheDocument();
    expect(screen.getByLabelText("Lowercase: met")).toBeInTheDocument();
    expect(screen.getByLabelText("Number: met")).toBeInTheDocument();
    expect(screen.getByLabelText("Symbol: met")).toBeInTheDocument();
  });

  it("reflects a mix of met and unmet requirements", () => {
    render(<PasswordRequirements password="abcdefgh" />);

    expect(screen.getByLabelText("8 + characters: met")).toBeInTheDocument();
    expect(screen.getByLabelText("Lowercase: met")).toBeInTheDocument();
    expect(screen.getByLabelText("Uppercase: not met")).toBeInTheDocument();
    expect(screen.getByLabelText("Number: not met")).toBeInTheDocument();
    expect(screen.getByLabelText("Symbol: not met")).toBeInTheDocument();
  });
});
