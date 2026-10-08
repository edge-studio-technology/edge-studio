import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CredentialField } from "../../../src/components/ui/CredentialField";
import type { AdminCredentialType } from "../../../src/features/auth/adminCredentials";

function ControlledField({ credentialType }: { credentialType: AdminCredentialType | null }) {
  const [value, setValue] = useState("");
  return <CredentialField credentialType={credentialType} label="Credential" value={value} onChange={setValue} />;
}

describe("CredentialField", () => {
  it("uses a masked numeric input and six visual slots for PINs", () => {
    const { container } = render(
      <CredentialField credentialType="pin" label="PIN" value="001234" onChange={vi.fn()} />,
    );
    const input = screen.getByLabelText("PIN");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("pattern", "[0-9]*");
    expect(input).toHaveValue("001234");
    expect(container.querySelector('[aria-hidden="true"]')?.children).toHaveLength(6);
    expect(container.querySelectorAll(".rounded-full.bg-current")).toHaveLength(6);
    expect(container).not.toHaveTextContent("001234");
  });

  it.each(["pin", "password", null] as const)("allows current/new password autofill for %s", (credentialType) => {
    const { rerender } = render(
      <CredentialField credentialType={credentialType} label="Credential" value="" onChange={vi.fn()} />,
    );
    const input = screen.getByLabelText("Credential");
    expect(input).toHaveAttribute("autocomplete", "current-password");
    for (const attribute of ["data-1p-ignore", "data-bwignore", "data-lpignore"]) {
      expect(input).not.toHaveAttribute(attribute);
    }
    rerender(
      <CredentialField credentialType={credentialType} label="Credential" value="" onChange={vi.fn()} autoComplete="new-password" />,
    );
    expect(screen.getByLabelText("Credential")).toHaveAttribute("autocomplete", "new-password");
  });

  it("preserves leading zeroes, filters non-digits, and bounds typed PINs", async () => {
    render(<ControlledField credentialType="pin" />);
    await userEvent.type(screen.getByLabelText("Credential"), "00a12b34567");
    expect(screen.getByLabelText("Credential")).toHaveValue("001234");
  });

  it("normalizes a pasted PIN and supports selection replacement, deletion, and clearing", async () => {
    const user = userEvent.setup();
    render(<ControlledField credentialType="pin" />);
    const input = screen.getByLabelText("Credential") as HTMLInputElement;
    await user.click(input);
    await user.paste("00-12 3456");
    expect(input).toHaveValue("001234");
    input.setSelectionRange(2, 4);
    await user.keyboard("9");
    expect(input).toHaveValue("00934");
    input.setSelectionRange(1, 1);
    await user.keyboard("{Delete}{Backspace}");
    expect(input).toHaveValue("934");
    await user.clear(input);
    expect(input).toHaveValue("");
  });

  it("normalizes a whole-value autofill change as a string", () => {
    const onChange = vi.fn();
    render(<CredentialField credentialType="pin" label="PIN" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("PIN"), { target: { value: "001234567" } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("001234");
  });

  it.each(["password", null] as const)("keeps %s entry unrestricted and does not enforce creation policy", async (credentialType) => {
    render(<ControlledField credentialType={credentialType} />);
    const input = screen.getByLabelText("Credential");
    expect(input).toHaveAttribute("type", "password");
    expect(input).not.toHaveAttribute("inputmode");
    expect(input).not.toHaveAttribute("pattern");
    expect(input).not.toHaveAttribute("maxlength");
    expect(input).not.toHaveAttribute("minlength");
    await userEvent.type(input, "weak");
    expect(input).toHaveValue("weak");
    await userEvent.clear(input);
    await userEvent.type(input, " 001234 long password! é ");
    expect(input).toHaveValue(" 001234 long password! é ");
  });

  it.each(["pin", "password", null] as const)("forwards field associations and native form attributes for %s", (credentialType) => {
    render(
      <form id="credential-form">
        <CredentialField credentialType={credentialType} id="credential" name="currentPassword" form="credential-form" label="Credential" description="Enter the saved credential" error="Invalid credential" required value="001234" onChange={vi.fn()} />
      </form>,
    );
    const input = screen.getByLabelText("Credential") as HTMLInputElement;
    expect(input).toHaveAttribute("id", "credential");
    expect(input).toHaveAttribute("name", "currentPassword");
    expect(input).toHaveAttribute("form", "credential-form");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "credential-description credential-error");
    expect(input).toHaveAccessibleDescription("Enter the saved credential Invalid credential");
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid credential");
    expect(new FormData(input.form!).get("currentPassword")).toBe("001234");
  });

  it.each(["pin", "password", null] as const)("preserves autofocus, focus/blur callbacks, and disabled behavior for %s", async (credentialType) => {
    const onChange = vi.fn();
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const props = { credentialType, label: "Credential", value: "", onChange, onFocus, onBlur, autoFocus: true };
    const { rerender } = render(<CredentialField {...props} />);
    const input = screen.getByLabelText("Credential");
    expect(input).toHaveFocus();
    expect(onFocus).toHaveBeenCalledOnce();
    await userEvent.tab();
    expect(onBlur).toHaveBeenCalledOnce();
    rerender(<CredentialField {...props} disabled />);
    await userEvent.type(input, "123456");
    expect(input).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(["pin", "password", null] as const)("submits %s only through the form's Enter action", async (credentialType) => {
    const onSubmit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <ControlledField credentialType={credentialType} />
        <button type="submit">Continue</button>
      </form>,
    );
    await userEvent.type(screen.getByLabelText("Credential"), "001234");
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("does not mutate a controlled draft or call onChange when metadata changes", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CredentialField credentialType={null} label="Credential" value="my password" onChange={onChange} />,
    );
    rerender(<CredentialField credentialType="pin" label="Credential" value="my password" onChange={onChange} />);
    rerender(<CredentialField credentialType="password" label="Credential" value="my password" onChange={onChange} />);
    expect(screen.getByLabelText("Credential")).toHaveValue("my password");
    expect(onChange).not.toHaveBeenCalled();
  });
});
