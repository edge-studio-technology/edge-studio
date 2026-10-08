import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "../../src/pages/LoginPage";

afterEach(() => vi.unstubAllGlobals());

describe("LoginPage credential metadata", () => {
  it.each([
    ["pin", "PIN", "Enter your PIN to continue."],
    ["password", "Password", "Enter your password to continue."],
    [null, "PIN or password", "Enter your PIN or password to continue."],
  ] as const)("uses %s wording for the credential hint", (credentialType, label, description) => {
    render(<LoginPage credentialType={credentialType} onSuccess={vi.fn()} />);

    expect(screen.getByLabelText(label)).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log In" })).toBeDisabled();
  });

  it("preserves the draft when metadata changes and does not submit automatically", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const onSuccess = vi.fn();
    const { rerender } = render(<LoginPage credentialType={null} onSuccess={onSuccess} />);
    await userEvent.type(screen.getByLabelText("PIN or password"), "012345");

    for (const credentialType of ["pin", "password", null] as const) {
      rerender(<LoginPage credentialType={credentialType} onSuccess={onSuccess} />);
      expect(screen.getByDisplayValue("012345")).toBeInTheDocument();
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each([
    ["password", "012345"],
    [null, "legacy"],
  ] as const)("accepts the existing credential with a %s hint and preserves the request", async (credentialType, credential) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onSuccess = vi.fn();
    render(<LoginPage credentialType={credentialType} onSuccess={onSuccess} />);
    const input = screen.getByLabelText(credentialType === "password" ? "Password" : "PIN or password");
    await userEvent.type(input, credential);
    await userEvent.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({
      credentials: "include",
      method: "POST",
      body: JSON.stringify({ password: credential }),
    }));
  });
});
