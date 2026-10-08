import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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
    ["pin", "001234"],
    ["password", "weak"],
    ["password", "012345"],
    [null, "legacy"],
  ] as const)("accepts the existing credential with a %s hint and preserves the request", async (credentialType, credential) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onSuccess = vi.fn();
    render(<LoginPage credentialType={credentialType} onSuccess={onSuccess} />);
    const input = screen.getByLabelText(credentialType === "pin" ? "PIN" : credentialType === "password" ? "Password" : "PIN or password");
    await userEvent.type(input, credential);
    await userEvent.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({
      credentials: "include",
      method: "POST",
      body: JSON.stringify({ password: credential }),
    }));
  });

  it("requires six PIN digits and submits through Enter without automatic login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onSuccess = vi.fn();
    render(<LoginPage credentialType="pin" onSuccess={onSuccess} />);
    const input = screen.getByLabelText("PIN");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("inputmode", "numeric");
    await userEvent.type(input, "00123");
    expect(screen.getByRole("button", { name: "Log In" })).toBeDisabled();
    fireEvent.submit(input.closest("form")!);
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.type(input, "456");
    expect(input).toHaveValue("001234");
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ body: JSON.stringify({ password: "001234" }) }));
  });

  it.each(["pin", "password"] as const)("retains %s entry on rejection and clears the error on editing", async (credentialType) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Invalid credential" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const onSuccess = vi.fn();
    render(<LoginPage credentialType={credentialType} onSuccess={onSuccess} />);
    const input = screen.getByLabelText(credentialType === "pin" ? "PIN" : "Password");
    const value = credentialType === "pin" ? "001234" : "weak";
    await userEvent.type(input, value);
    await userEvent.click(screen.getByRole("button", { name: "Log In" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credential");
    expect(input).toHaveValue(value);
    expect(onSuccess).not.toHaveBeenCalled();
    await userEvent.clear(input);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("LoginPage with authenticator codes enabled", () => {
  let TotpLoginPage: typeof LoginPage;
  beforeAll(async () => {
    vi.resetModules();
    vi.doMock("../../src/features/auth/totpEnabled", () => ({ TOTP_ENABLED: true }));
    ({ LoginPage: TotpLoginPage } = await import("../../src/pages/LoginPage"));
  });
  afterAll(() => {
    vi.doUnmock("../../src/features/auth/totpEnabled");
    vi.resetModules();
  });

  it.each(["pin", "password"] as const)("keeps the authenticator input separate from %s credentials", async (type) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onSuccess = vi.fn();
    render(<TotpLoginPage credentialType={type} onSuccess={onSuccess} />);
    await userEvent.type(screen.getByLabelText(type === "pin" ? "PIN" : "Password"), type === "pin" ? "001234" : "weak");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    const code = screen.getByLabelText("Authentication code");
    expect(code).toHaveAttribute("type", "text");
    expect(code).toHaveAttribute("autocomplete", "one-time-code");
    expect(code).toHaveAttribute("data-1p-ignore");
    await userEvent.type(code, "000000");
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ body: JSON.stringify({ password: type === "pin" ? "001234" : "weak", totpToken: "000000" }) }));
  });
});
