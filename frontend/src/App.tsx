import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { useAuth } from "./auth/AuthContext";
import { FullScreenLoader } from "./components/FullScreenLoader";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { AppShell } from "./layout/AppShell";
import { OverviewPage } from "./pages/OverviewPage";
import { AlertsPage } from "./pages/AlertsPage";
import { VulnerabilitiesPage } from "./pages/VulnerabilitiesPage";
import { EndpointsPage } from "./pages/EndpointsPage";
import { ThreatHuntingPage } from "./pages/ThreatHuntingPage";
import { FimPage } from "./pages/FimPage";
import { ScaPage } from "./pages/ScaPage";
import { MalwarePage } from "./pages/MalwarePage";
import { MitrePage } from "./pages/MitrePage";
import { ThreatIntelPage } from "./pages/ThreatIntelPage";
import { ThreatIntelLayout } from "./pages/threat-intel/ThreatIntelLayout";
import { EntityListPage } from "./pages/threat-intel/EntityListPage";
import { EntityDetailPage } from "./pages/threat-intel/EntityDetailPage";
import { AttackCoveragePage } from "./pages/threat-intel/AttackCoveragePage";
import { CasesPage } from "./pages/threat-intel/CasesPage";
import { CaseDetailPage } from "./pages/threat-intel/CaseDetailPage";
import { IncidentsPage } from "./pages/IncidentsPage";
import { ResponseActionsPage } from "./pages/ResponseActionsPage";
import { TicketsPage } from "./pages/TicketsPage";
import { AuditPage } from "./pages/AuditPage";
import { CompliancePage } from "./pages/CompliancePage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { RolesPage } from "./pages/RolesPage";
import { UsersPage } from "./pages/UsersPage";
import { ProfilePage } from "./pages/ProfilePage";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={user ? <Navigate to="/app" replace /> : <LoginPage />}
      />
      <Route element={<RequireAuth />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="vulnerabilities" element={<VulnerabilitiesPage />} />
          <Route path="endpoints" element={<EndpointsPage />} />
          <Route path="hunting" element={<ThreatHuntingPage />} />
          <Route path="fim" element={<FimPage />} />
          <Route path="sca" element={<ScaPage />} />
          <Route path="malware" element={<MalwarePage />} />
          <Route path="mitre" element={<MitrePage />} />
          <Route path="threat-intel" element={<ThreatIntelLayout />}>
            <Route index element={<ThreatIntelPage />} />
            <Route path="attack-coverage" element={<AttackCoveragePage />} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="cases/:id" element={<CaseDetailPage />} />
            <Route path=":type" element={<EntityListPage />} />
            <Route path=":type/:id" element={<EntityDetailPage />} />
          </Route>
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="response-actions" element={<ResponseActionsPage />} />
          <Route path="compliance" element={<CompliancePage />} />
          <Route path="compliance/:frameworkId" element={<CompliancePage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route element={<RequireAuth roles={["ADMINISTRATOR"]} />}>
            <Route path="users" element={<UsersPage />} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={user ? "/app" : "/"} replace />} />
    </Routes>
  );
}
