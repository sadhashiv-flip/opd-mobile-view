import { Navigate, Route, Routes } from "react-router-dom";
import { ROUTES } from "../constants";
import { AddFamilyMemberPage } from "../pages/AddFamilyMemberPage";
import { BookingSuccessPage } from "../pages/BookingSuccessPage";
import { ConsultationTypePage } from "../pages/ConsultationTypePage";
import { DiagnosticsScreenPage } from "../pages/DiagnosticsScreenPage";
import { DiagnosticsSlotsPage } from "../pages/DiagnosticsSlotsPage";
import { HealthCheckupsOverviewPage } from "../pages/HealthCheckupsOverviewPage";
import { HealthCheckupsPage } from "../pages/HealthCheckupsPage";
import { HealthCheckupsPlanPage } from "../pages/HealthCheckupsPlanPage";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { OtpPage } from "../pages/OtpPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { ServicesHubPage } from "../pages/ServicesHubPage";

/** Route table only — add screens here without touching `App` shell (OCP). */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.root} element={<LoginPage />} />
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.otp} element={<OtpPage />} />
      <Route path={ROUTES.dashboard} element={<HomePage />} />
      <Route path="/home" element={<Navigate to={ROUTES.dashboard} replace />} />
      <Route path={ROUTES.services} element={<ServicesHubPage />} />
      <Route path={ROUTES.healthCheckups} element={<HealthCheckupsPage />} />
      <Route path={ROUTES.addFamilyMember} element={<AddFamilyMemberPage />} />
      <Route path={ROUTES.healthCheckupsPlan} element={<HealthCheckupsPlanPage />} />
      <Route path={ROUTES.diagnosticsScreen} element={<DiagnosticsScreenPage />} />
      <Route path={ROUTES.diagnosticsSlots} element={<DiagnosticsSlotsPage />} />
      <Route path={ROUTES.healthCheckupsOverview} element={<HealthCheckupsOverviewPage />} />
      <Route path={ROUTES.bookingSuccess} element={<BookingSuccessPage />} />
      <Route path={ROUTES.consultation} element={<ConsultationTypePage />} />
      <Route path={ROUTES.dental} element={<PlaceholderPage title="Dental" />} />
      <Route path={ROUTES.vision} element={<PlaceholderPage title="Vision" />} />
      <Route
        path={ROUTES.pharmacy}
        element={<PlaceholderPage title="Pharmacy" />}
      />
      <Route
        path={ROUTES.orders}
        element={<PlaceholderPage title="My Orders" />}
      />
      <Route
        path={ROUTES.help}
        element={<PlaceholderPage title="Need Help?" />}
      />
      <Route path="*" element={<Navigate to={ROUTES.root} replace />} />
    </Routes>
  );
}
