import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../../src/features/auth/AuthProvider";
import { useAuth } from "../../../src/features/auth/hooks";

const getSetupStatus = vi.fn();
const getMe = vi.fn();
const logout = vi.fn();

vi.mock("../../../src/features/auth/api", () => ({
  getSetupStatus: (...args: unknown[]) => getSetupStatus(...args),
  getMe: (...args: unknown[]) => getMe(...args),
  logout: (...args: unknown[]) => logout(...args),
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

function Consumer() {
  const { user, loading, showSetup, showLogin, signOut, refreshSession } = useAuth();
  return (
    <div>
      <p>loading:{String(loading)}</p>
      <p>showSetup:{String(showSetup)}</p>
      <p>showLogin:{String(showLogin)}</p>
      <p>user:{user ? user.displayName : "none"}</p>
      <button onClick={() => void signOut()}>Sign out</button>
      <button onClick={() => void refreshSession()}>Refresh</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    getSetupStatus.mockReset();
    getMe.mockReset();
    logout.mockReset();
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
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: true });
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
    getSetupStatus.mockResolvedValue({ localAdminCreated: false, setupComplete: false });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(await screen.findByText("OnboardingWizard resumeAtConnect:false")).toBeInTheDocument();
    expect(getMe).not.toHaveBeenCalled();
  });

  it("resumes the onboarding wizard at the connect step when setup is incomplete", async () => {
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: false });
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
      .mockResolvedValueOnce({ localAdminCreated: false, setupComplete: false })
      .mockResolvedValueOnce({ localAdminCreated: true, setupComplete: true });
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
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: true });
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
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: false });
    getMe.mockRejectedValue(new Error("unauthorized"));
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(await screen.findByText("showLogin:true")).toBeInTheDocument();
    expect(screen.queryByText(/OnboardingWizard/)).not.toBeInTheDocument();
  });

  it("shows login when the setup status request fails", async () => {
    getSetupStatus.mockRejectedValue(new Error("network down"));
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(await screen.findByText("showLogin:true")).toBeInTheDocument();
    expect(screen.getByText("user:none")).toBeInTheDocument();
    expect(getMe).not.toHaveBeenCalled();
  });

  it("refreshes the session after resumed onboarding completes", async () => {
    getSetupStatus
      .mockResolvedValueOnce({ localAdminCreated: true, setupComplete: false })
      .mockResolvedValueOnce({ localAdminCreated: true, setupComplete: true });
    getMe.mockResolvedValue({ displayName: "Admin", role: "admin", credentialType: "pin" });
    render(<AuthProvider><Consumer /></AuthProvider>);
    await screen.findByText("OnboardingWizard resumeAtConnect:true");
    await userEvent.click(screen.getByRole("button", { name: "Complete setup" }));
    expect(await screen.findByText("user:Admin")).toBeInTheDocument();
    expect(getSetupStatus).toHaveBeenCalledTimes(2);
    expect(getMe).toHaveBeenCalledTimes(2);
  });

  it("signOut clears the session and shows login even if the logout request fails", async () => {
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: true });
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
    getSetupStatus.mockResolvedValue({ localAdminCreated: true, setupComplete: true });
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
  });
});
