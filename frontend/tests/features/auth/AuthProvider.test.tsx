import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../../src/features/auth/AuthProvider";
import { useAuth } from "../../../src/features/auth/hooks";
import { LoginPage } from "../../../src/pages/LoginPage";
import type { AuthUser, SetupStatus } from "../../../src/features/auth/types";

const getSetupStatus = vi.fn();
const getMe = vi.fn();
const logout = vi.fn();
const login = vi.fn();

vi.mock("../../../src/features/auth/api", () => ({
  getSetupStatus: (...args: unknown[]) => getSetupStatus(...args),
  getMe: (...args: unknown[]) => getMe(...args),
  logout: (...args: unknown[]) => logout(...args),
  login: (...args: unknown[]) => login(...args),
}));

const setUnauthorizedHandler = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  setUnauthorizedHandler: (...args: unknown[]) => setUnauthorizedHandler(...args),
}));

const onboardingWizardMock = vi.fn();

vi.mock("../../../src/features/setup/OnboardingWizard", () => ({
  OnboardingWizard: (props: { onComplete: () => void; resumeAtConnect?: boolean }) => {
    onboardingWizardMock(props);
    return (
      <div>
        <p>OnboardingWizard resumeAtConnect:{String(props.resumeAtConnect)}</p>
        <button onClick={props.onComplete}>Complete setup</button>
      </div>
    );
  },
}));

let authValue: ReturnType<typeof useAuth>;

function Consumer() {
  authValue = useAuth();
  const { user, credentialType, loading, showSetup, showLogin, sessionNotice, signOut, refreshSession } = authValue;
  return (
    <div>
      <p>loading:{String(loading)}</p>
      <p>showSetup:{String(showSetup)}</p>
      <p>showLogin:{String(showLogin)}</p>
      <p>sessionNotice:{sessionNotice ?? "none"}</p>
      <p>user:{user ? user.displayName : "none"}</p>
      <p>credentialType:{credentialType ?? "unknown"}</p>
      <button onClick={() => void signOut()}>Sign out</button>
      <button onClick={() => void refreshSession()}>Refresh</button>
    </div>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function expireSession() {
  const handler = setUnauthorizedHandler.mock.calls[setUnauthorizedHandler.mock.calls.length - 1][0] as () => void;
  act(() => handler());
}

describe("AuthProvider", () => {
  beforeEach(() => {
    getSetupStatus.mockReset();
    getMe.mockReset();
    logout.mockReset();
    login.mockReset();
    setUnauthorizedHandler.mockReset();
    onboardingWizardMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading state before the session check resolves", () => {
    getSetupStatus.mockReturnValue(new Promise(() => {}));
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders children with the resolved user once setup is complete", async () => {
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: true, credentialType: "pin" });
    getMe.mockResolvedValue({ displayName: "Admin", role: "admin", credentialType: "pin" });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(await screen.findByText("user:Admin")).toBeInTheDocument();
    expect(screen.getByText("showSetup:false")).toBeInTheDocument();
    expect(screen.getByText("showLogin:false")).toBeInTheDocument();
  });

  it("renders the onboarding wizard fresh when no local admin has been created", async () => {
    getSetupStatus.mockResolvedValue({ localAdminCreated: false, setupComplete: false, credentialType: null });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(await screen.findByText("OnboardingWizard resumeAtConnect:false")).toBeInTheDocument();
    expect(getMe).not.toHaveBeenCalled();
  });

  it("resumes the onboarding wizard at the connect step when setup is incomplete", async () => {
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: false, credentialType: "pin" });
    getMe.mockResolvedValue({ displayName: "Admin", role: "admin", credentialType: "pin" });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(await screen.findByText("OnboardingWizard resumeAtConnect:true")).toBeInTheDocument();
  });

  it("completing onboarding re-runs the session check", async () => {
    getSetupStatus
      .mockResolvedValueOnce({ localAdminCreated: false, setupComplete: false, credentialType: null })
      .mockResolvedValueOnce({ localAdminCreated: true, setupComplete: true, credentialType: "pin" });
    getMe.mockResolvedValue({ displayName: "Admin", role: "admin", credentialType: "pin" });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await screen.findByText("OnboardingWizard resumeAtConnect:false");
    await userEvent.click(screen.getByRole("button", { name: "Complete setup" }));

    expect(await screen.findByText("user:Admin")).toBeInTheDocument();
    expect(getSetupStatus).toHaveBeenCalledTimes(2);
  });

  it("shows the login state when the session lookup fails", async () => {
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: true, credentialType: "pin" });
    getMe.mockRejectedValue(new Error("unauthorized"));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(await screen.findByText("showLogin:true")).toBeInTheDocument();
    expect(screen.getByText("user:none")).toBeInTheDocument();
    expect(screen.getByText("showSetup:false")).toBeInTheDocument();
  });

  it("shows login instead of resuming onboarding when the incomplete-setup session lookup fails", async () => {
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: false, credentialType: "pin" });
    getMe.mockRejectedValue(new Error("unauthorized"));
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(await screen.findByText("showLogin:true")).toBeInTheDocument();
    expect(screen.queryByText(/OnboardingWizard/)).not.toBeInTheDocument();
    expect(screen.getByText("credentialType:pin")).toBeInTheDocument();
    getMe.mockResolvedValueOnce({ displayName: "Admin", role: "admin", credentialType: "pin" });
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("OnboardingWizard resumeAtConnect:true")).toBeInTheDocument();
  });

  it("shows login when the setup status request fails", async () => {
    getSetupStatus.mockRejectedValue(new Error("network down"));
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(await screen.findByText("showLogin:true")).toBeInTheDocument();
    expect(screen.getByText("user:none")).toBeInTheDocument();
    expect(getMe).not.toHaveBeenCalled();
    expect(screen.getByText("credentialType:unknown")).toBeInTheDocument();
  });

  it("refreshes the session after resumed onboarding completes", async () => {
    getSetupStatus
      .mockResolvedValueOnce({ localAdminCreated: true, setupComplete: false, credentialType: "pin" })
      .mockResolvedValueOnce({ localAdminCreated: true, setupComplete: true, credentialType: "pin" });
    getMe.mockResolvedValue({ displayName: "Admin", role: "admin", credentialType: "pin" });
    render(<AuthProvider><Consumer /></AuthProvider>);
    await screen.findByText("OnboardingWizard resumeAtConnect:true");
    await userEvent.click(screen.getByRole("button", { name: "Complete setup" }));
    expect(await screen.findByText("user:Admin")).toBeInTheDocument();
    expect(getSetupStatus).toHaveBeenCalledTimes(2);
    expect(getMe).toHaveBeenCalledTimes(2);
  });

  it("signOut clears the session and shows login even if the logout request fails", async () => {
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: true, credentialType: "pin" });
    getMe.mockResolvedValue({ displayName: "Admin", role: "admin", credentialType: "pin" });
    logout.mockRejectedValue(new Error("network down"));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await screen.findByText("user:Admin");
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(logout).toHaveBeenCalled();
    expect(await screen.findByText("user:none")).toBeInTheDocument();
    expect(screen.getByText("showLogin:true")).toBeInTheDocument();
  });

  it("registers an unauthorized handler that clears the session when invoked", async () => {
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: true, credentialType: "pin" });
    getMe.mockResolvedValue({ displayName: "Admin", role: "admin", credentialType: "pin" });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await screen.findByText("user:Admin");

    expect(setUnauthorizedHandler).toHaveBeenCalled();
    const handler = setUnauthorizedHandler.mock.calls[setUnauthorizedHandler.mock.calls.length - 1][0] as () => void;
    act(() => handler());

    expect(await screen.findByText("user:none")).toBeInTheDocument();
    expect(screen.getByText("showLogin:true")).toBeInTheDocument();
    expect(screen.getByText("sessionNotice:Edge Studio restarted or your session expired. Enter your PIN or password to continue.")).toBeInTheDocument();
  });

  it.each(["pin", "password", null] as const)("uses public %s metadata for a fresh login", async (credentialType) => {
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: true, credentialType });
    getMe.mockRejectedValue(new Error("unauthorized"));
    render(<AuthProvider><Consumer /></AuthProvider>);

    expect(await screen.findByText(`credentialType:${credentialType ?? "unknown"}`)).toBeInTheDocument();
    expect(screen.getByText("showLogin:true")).toBeInTheDocument();
  });

  it.each(["pin", "password"] as const)("prefers the authenticated %s type over the public hint", async (credentialType) => {
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: true, credentialType: credentialType === "pin" ? "password" : "pin" });
    getMe.mockResolvedValue({ displayName: "Admin", role: "admin", credentialType });
    render(<AuthProvider><Consumer /></AuthProvider>);

    expect(await screen.findByText(`credentialType:${credentialType}`)).toBeInTheDocument();
    expect(screen.getByText("user:Admin")).toBeInTheDocument();
  });

  it.each(["pin", "password"] as const)("refreshes to %s after a credential change and sign-out", async (credentialType) => {
    getSetupStatus
      .mockResolvedValueOnce({ localAdminCreated: true, setupComplete: true, credentialType: credentialType === "pin" ? "password" : "pin" })
      .mockResolvedValueOnce({ localAdminCreated: true, setupComplete: true, credentialType });
    getMe.mockResolvedValue({ displayName: "Admin", role: "admin", credentialType: credentialType === "pin" ? "password" : "pin" });
    logout.mockResolvedValue({ success: true });
    render(<AuthProvider><Consumer /></AuthProvider>);
    await screen.findByText("user:Admin");
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByText(`credentialType:${credentialType}`)).toBeInTheDocument();
    expect(screen.getByText("user:none")).toBeInTheDocument();
    expect(getSetupStatus).toHaveBeenCalledTimes(2);
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it("clears a stale hint while logout metadata is pending and keeps it unknown on failure", async () => {
    const status = deferred<SetupStatus>();
    getSetupStatus
      .mockResolvedValueOnce({ localAdminCreated: true, setupComplete: true, credentialType: "pin" })
      .mockReturnValueOnce(status.promise);
    getMe.mockResolvedValue({ displayName: "Admin", role: "admin", credentialType: "pin" });
    render(<AuthProvider><Consumer /></AuthProvider>);
    await screen.findByText("user:Admin");
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByText("credentialType:unknown")).toBeInTheDocument();

    await act(async () => status.reject(new Error("unavailable")));
    expect(screen.getByText("credentialType:unknown")).toBeInTheDocument();
    expect(screen.getByText("showLogin:true")).toBeInTheDocument();
  });

  it.each(["pin", "password"] as const)("refreshes an expired authenticated session's hint to %s", async (credentialType) => {
    const previousType = credentialType === "pin" ? "password" : "pin";
    getSetupStatus
      .mockResolvedValueOnce({ localAdminCreated: true, setupComplete: true, credentialType: previousType })
      .mockResolvedValueOnce({ localAdminCreated: true, setupComplete: true, credentialType });
    getMe.mockResolvedValueOnce({ displayName: "Admin", role: "admin", credentialType: previousType });
    render(<AuthProvider><Consumer /></AuthProvider>);
    await screen.findByText("user:Admin");
    expireSession();

    expect(await screen.findByText(`credentialType:${credentialType}`)).toBeInTheDocument();
    expect(screen.getByText("user:none")).toBeInTheDocument();
    expect(screen.getByText("showLogin:true")).toBeInTheDocument();
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it("refreshes expired-session metadata while preserving the login draft and avoiding submission", async () => {
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: true, credentialType: "pin" });
    getMe.mockRejectedValue(new Error("unauthorized"));
    function LoginConsumer() {
      const { credentialType, sessionNotice } = useAuth();
      return <LoginPage credentialType={credentialType} sessionNotice={sessionNotice} onSuccess={vi.fn()} />;
    }
    render(<AuthProvider><LoginConsumer /></AuthProvider>);
    const input = await screen.findByLabelText("PIN");
    await userEvent.type(input, "012345");

    const status = deferred<SetupStatus>();
    getSetupStatus.mockReturnValueOnce(status.promise);
    expireSession();
    expect(screen.getByLabelText("PIN or password")).toHaveValue("012345");
    await act(async () => status.resolve({ localAdminCreated: true, setupComplete: true, credentialType: "password" }));
    expect(screen.getByLabelText("Password")).toHaveValue("012345");

    getSetupStatus.mockRejectedValueOnce(new Error("unavailable"));
    expireSession();
    expect(await screen.findByLabelText("PIN or password")).toHaveValue("012345");
    expect(login).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"] as const)("ignores an older hint request that later %ss", async (outcome) => {
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: true, credentialType: "password" });
    getMe.mockResolvedValue({ displayName: "Admin", role: "admin", credentialType: "pin" });
    render(<AuthProvider><Consumer /></AuthProvider>);
    await screen.findByText("user:Admin");
    const status = deferred<SetupStatus>();
    getSetupStatus.mockReturnValueOnce(status.promise);
    expireSession();
    expireSession();
    await screen.findByText("credentialType:password");

    await act(async () => {
      if (outcome === "resolve") status.resolve({ localAdminCreated: true, setupComplete: true, credentialType: "pin" });
      else status.reject(new Error("old failure"));
    });
    expect(screen.getByText("credentialType:password")).toBeInTheDocument();
  });

  it.each(["resolve", "reject"] as const)("ignores an in-flight session response that %ss after expiry", async (outcome) => {
    const me = deferred<AuthUser>();
    getSetupStatus
      .mockResolvedValueOnce({ localAdminCreated: true, setupComplete: true, credentialType: "pin" })
      .mockResolvedValueOnce({ localAdminCreated: true, setupComplete: true, credentialType: "password" });
    getMe.mockReturnValueOnce(me.promise);
    render(<AuthProvider><Consumer /></AuthProvider>);
    await act(async () => {});
    expect(getMe).toHaveBeenCalledTimes(1);
    expireSession();
    await screen.findByText("credentialType:password");

    await act(async () => {
      if (outcome === "resolve") me.resolve({ displayName: "Admin", role: "admin", credentialType: "pin" });
      else me.reject(new Error("old failure"));
    });
    expect(screen.getByText("credentialType:password")).toBeInTheDocument();
    expect(screen.getByText("user:none")).toBeInTheDocument();
    expect(screen.getByText("showLogin:true")).toBeInTheDocument();
  });

  it.each(["resolve", "reject"] as const)("ignores an older session status request that later %ss", async (outcome) => {
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: true, credentialType: "password" });
    getMe.mockResolvedValue({ displayName: "Admin", role: "admin", credentialType: "password" });
    render(<AuthProvider><Consumer /></AuthProvider>);
    await screen.findByText("user:Admin");
    const status = deferred<SetupStatus>();
    getSetupStatus.mockReturnValueOnce(status.promise);
    const refresh = authValue.refreshSession;
    let older!: Promise<void>;
    act(() => { older = refresh(); });
    await act(async () => refresh());

    await act(async () => {
      if (outcome === "resolve") status.resolve({ localAdminCreated: false, setupComplete: false, credentialType: null });
      else status.reject(new Error("old failure"));
      await older;
    });
    expect(screen.getByText("credentialType:password")).toBeInTheDocument();
    expect(screen.getByText("user:Admin")).toBeInTheDocument();
    expect(getMe).toHaveBeenCalledTimes(2);
  });

  it("does not let a late logout response clear a newer authenticated session", async () => {
    const pendingLogout = deferred<{ success: boolean }>();
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: true, credentialType: "pin" });
    getMe.mockResolvedValue({ displayName: "Admin", role: "admin", credentialType: "pin" });
    logout.mockReturnValueOnce(pendingLogout.promise);
    render(<AuthProvider><Consumer /></AuthProvider>);
    await screen.findByText("user:Admin");
    let signingOut!: Promise<void>;
    act(() => { signingOut = authValue.signOut(); });
    getMe.mockResolvedValueOnce({ displayName: "Admin", role: "admin", credentialType: "password" });
    await act(async () => authValue.refreshSession());
    await act(async () => { pendingLogout.resolve({ success: true }); await signingOut; });

    expect(screen.getByText("user:Admin")).toBeInTheDocument();
    expect(screen.getByText("credentialType:password")).toBeInTheDocument();
    expect(getSetupStatus).toHaveBeenCalledTimes(2);
  });

  it("clears authenticated metadata if a later session refresh cannot read status", async () => {
    getSetupStatus.mockResolvedValueOnce({ localAdminCreated: true, setupComplete: true, credentialType: "pin" });
    getMe.mockResolvedValue({ displayName: "Admin", role: "admin", credentialType: "pin" });
    render(<AuthProvider><Consumer /></AuthProvider>);
    await screen.findByText("user:Admin");
    getSetupStatus.mockRejectedValueOnce(new Error("unavailable"));
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByText("credentialType:unknown")).toBeInTheDocument();
    expect(screen.getByText("user:none")).toBeInTheDocument();
  });

  it("ignores a bootstrap response after unmount", async () => {
    const status = deferred<SetupStatus>();
    getSetupStatus.mockReturnValueOnce(status.promise);
    const { unmount } = render(<AuthProvider><Consumer /></AuthProvider>);
    unmount();
    await act(async () => status.resolve({ localAdminCreated: true, setupComplete: true, credentialType: "pin" }));

    expect(getMe).not.toHaveBeenCalled();
    expect(setUnauthorizedHandler).toHaveBeenLastCalledWith(null);
  });
});
