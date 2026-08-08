import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ToastProvider } from "./components/ToastProvider";
import { AuthProvider, useAuth } from "./features/auth";
import { LoginPage } from "./features/auth/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DataSourcesPage } from "./pages/DataSourcesPage";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { IntegritasPage } from "./pages/IntegritasPage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { MinimaPage } from "./pages/MinimaPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AutomationPage } from "./pages/AutomationPage";
import { SetupPage } from "./pages/SetupPage";
import { WalletPage } from "./pages/WalletPage";
import { AuthSettingsPage } from "./pages/AuthSettingsPage";
import { UpdatePage } from "./pages/UpdatePage";

function LoginRoute() {
  const { user, refreshSession } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return <LoginPage onSuccess={() => void refreshSession()} />;
}

function AppContent() {
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  const fullBleed = /^\/automation\/(new|[^/]+\/(edit|watch)(\/[^/]+)?)$/.test(pathname);

  return (
    <AppShell fullBleed={fullBleed} onSignOut={() => void signOut()}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/node" element={<MinimaPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/integritas" element={<IntegritasPage />} />
        <Route path="/data" element={<DataSourcesPage />} />
        <Route path="/automation" element={<AutomationPage />} />
        <Route path="/automation/new" element={<AutomationPage />} />
        <Route path="/automation/:workflowId/edit" element={<AutomationPage />} />
        <Route path="/automation/:workflowId/watch" element={<AutomationPage />} />
        <Route path="/automation/:workflowId/watch/:runId" element={<AutomationPage />} />
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
