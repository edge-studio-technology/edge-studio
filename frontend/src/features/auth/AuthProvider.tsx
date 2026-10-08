import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { setUnauthorizedHandler } from "../../lib/api";
import { getMe, getSetupStatus, logout } from "./api";
import { AuthContext } from "./hooks";
import { OnboardingWizard } from "../setup/OnboardingWizard";
import type { AuthUser } from "./types";
import type { AdminCredentialType } from "./adminCredentials";

type SetupMode = "fresh" | "resume" | null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState<SetupMode>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [credentialHint, setCredentialHint] = useState<AdminCredentialType | null>(null);
  const requestVersion = useRef(0);

  const refreshCredentialHint = useCallback(async () => {
    const version = ++requestVersion.current;
    setCredentialHint(null);
    try {
      const status = await getSetupStatus();
      if (version !== requestVersion.current) return;
      setCredentialHint(status.credentialType);
    } catch {
      if (version !== requestVersion.current) return;
      setCredentialHint(null);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setCredentialHint(null);
    try {
      const status = await getSetupStatus();
      if (version !== requestVersion.current) return;
      setCredentialHint(status.credentialType);
      if (!status.localAdminCreated) {
        setSetupMode("fresh");
        setShowLogin(false);
        setUser(null);
        return;
      }

      try {
        const me = await getMe();
        if (version !== requestVersion.current) return;
        setUser(me);
        setShowLogin(false);
        setSessionNotice(null);
        setSetupMode(status.setupComplete ? null : "resume");
      } catch {
        if (version !== requestVersion.current) return;
        setUser(null);
        setShowLogin(true);
        setSetupMode(null);
      }
    } catch {
      if (version !== requestVersion.current) return;
      setCredentialHint(null);
      setUser(null);
      setShowLogin(true);
      setSetupMode(null);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
    return () => { requestVersion.current += 1; };
  }, [refreshSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setShowLogin(true);
      setLoading(false);
      setSessionNotice("Edge Studio restarted or your session expired. Enter your PIN or password to continue.");
      setSetupMode(null);
      void refreshCredentialHint();
    });
    return () => setUnauthorizedHandler(null);
  }, [refreshCredentialHint]);

  const signOut = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      await logout();
    } catch {
      // Clear local state even if logout request fails
    }
    if (version !== requestVersion.current) return;
    setUser(null);
    setShowLogin(true);
    setLoading(false);
    setSessionNotice(null);
    setSetupMode(null);
    void refreshCredentialHint();
  }, [refreshCredentialHint]);

  const showSetup = setupMode !== null;
  const credentialType = user?.credentialType ?? credentialHint;
  const value = useMemo(
    () => ({
      user,
      credentialType,
      loading,
      showSetup,
      showLogin,
      sessionNotice,
      signOut,
      refreshSession,
    }),
    [user, credentialType, loading, showSetup, showLogin, sessionNotice, signOut, refreshSession],
  );

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-600">
        <p>Loading…</p>
      </div>
    );
  }

  if (showSetup) {
    return (
      <OnboardingWizard
        resumeAtConnect={setupMode === "resume"}
        onComplete={() => void refreshSession()}
      />
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
