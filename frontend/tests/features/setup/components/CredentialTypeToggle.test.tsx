import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CredentialTypeToggle } from "../../../../src/features/setup/components/CredentialTypeToggle";

describe("CredentialTypeToggle", () => {
  it("renders a radiogroup with a radio per option", () => {
    render(<CredentialTypeToggle label="Sign in method" value="pin" onChange={vi.fn()} />);

    expect(screen.getByRole("radiogroup", { name: "Sign in method" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "6-digit PIN" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Password" })).toHaveAttribute("aria-checked", "false");
  });

  it("marks password as checked when value is password", () => {
    render(<CredentialTypeToggle label="Sign in method" value="password" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "6-digit PIN" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "Password" })).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange with the clicked option's value", async () => {
    const onChange = vi.fn();
    render(<CredentialTypeToggle label="Sign in method" value="pin" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "Password" }));

    expect(onChange).toHaveBeenCalledWith("password");
  });
});
