import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ToastProvider } from "./components/ToastProvider";
import { AuthProvider, useAuth } from "./features/auth";
import { DashboardPage } from "./pages/DashboardPage";
import { DataSourcesPage } from "./pages/DataSourcesPage";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { IntegritasPage } from "./pages/IntegritasPage";
import { LoginPage } from "./pages/LoginPage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { MinimaPage } from "./pages/MinimaPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AutomationPage } from "./pages/AutomationPage";
import { AutomationHelpPage } from "./pages/AutomationHelpPage";
import { WalletPage } from "./pages/WalletPage";
import { AuthSettingsPage } from "./pages/AuthSettingsPage";
import { UpdatePage } from "./pages/UpdatePage";

const ModuleDemo = lazy(() => import("./features/module-builder-demo/ModuleDemo"));
const ModuleStrategyResearch = lazy(() => import("./features/module-strategy-research/ModuleStrategyResearch"));

function LoginRoute() {
  const { user, credentialType, refreshSession, sessionNotice } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return <LoginPage credentialType={credentialType} sessionNotice={sessionNotice} onSuccess={() => void refreshSession()} />;
}

function AppContent() {
  const { pathname } = useLocation();
  const fullBleed = /^\/workflows\/(new|[^/]+\/(edit|watch)(\/[^/]+)?)$/.test(pathname);

  return (
    <AppShell fullBleed={fullBleed}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/node" element={<MinimaPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/integritas" element={<IntegritasPage />} />
        <Route path="/data" element={<DataSourcesPage />} />
        <Route path="/workflows" element={<AutomationPage />} />
        <Route path="/workflows/help" element={<AutomationHelpPage />} />
        <Route path="/workflows/new" element={<AutomationPage />} />
        <Route path="/workflows/:workflowId/edit" element={<AutomationPage />} />
        <Route path="/workflows/:workflowId/watch" element={<AutomationPage />} />
        <Route path="/workflows/:workflowId/watch/:runId" element={<AutomationPage />} />
        <Route path="/diagnostics" element={<DiagnosticsPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/settings" element={<AuthSettingsPage />} />
        <Route path="/update" element={<UpdatePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  const { pathname } = useLocation();
  if (pathname === "/demo/research" || pathname.startsWith("/demo/research/")) {
    return <ToastProvider><Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-zinc-400">Opening the strategy workshop…</div>}><ModuleStrategyResearch /></Suspense></ToastProvider>;
  }
  if (pathname.startsWith("/demo/modules") || pathname.startsWith("/demo/library")) {
    return (
      <ToastProvider>
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-zinc-400">Opening the concept workspace…</div>}>
          <ModuleDemo />
        </Suspense>
      </ToastProvider>
    );
  }
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppContent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
