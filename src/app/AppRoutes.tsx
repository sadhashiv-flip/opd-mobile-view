import { Navigate, Route, Routes } from "react-router-dom";
import { ROUTES } from "../constants";
import { AddFamilyMemberPage } from "../pages/AddFamilyMemberPage";
import { BookingSuccessPage } from "../pages/BookingSuccessPage";
import { ConsultationAppointmentSlotsPage } from "../pages/ConsultationAppointmentSlotsPage";
import { ConsultationAppointmentOverviewPage } from "../pages/ConsultationAppointmentOverviewPage";
import { ConsultationHospitalResultsPage } from "../pages/ConsultationHospitalResultsPage";
import { DiagnosticsScreenPage } from "../pages/DiagnosticsScreenPage";
import { DiagnosticsSlotsPage } from "../pages/DiagnosticsSlotsPage";
import { ConsultationSpecialtiesPage } from "../pages/ConsultationSpecialtiesPage";
import { HealthCheckupsOverviewPage } from "../pages/HealthCheckupsOverviewPage";
import { HealthCheckupsPage } from "../pages/HealthCheckupsPage";
import { HealthCheckupsPlanPage } from "../pages/HealthCheckupsPlanPage";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { OtpPage } from "../pages/OtpPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { ServicesHubPage } from "../pages/ServicesHubPage";
import { GymMembershipPage } from "@/pages/GymMembershipPage";

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

      {/* Diagnostics flows (Health Checkups, Lab Tests, etc.) */}
      <Route path={ROUTES.diagnosticsType} element={<HealthCheckupsPage />} />
      <Route path={ROUTES.diagnosticsAddFamilyMember} element={<AddFamilyMemberPage />} />
      <Route path={ROUTES.diagnosticsPlan} element={<HealthCheckupsPlanPage />} />
      <Route path={ROUTES.diagnosticsVendors} element={<DiagnosticsScreenPage />} />
      <Route path={ROUTES.diagnosticsSlots} element={<DiagnosticsSlotsPage />} />
      <Route path={ROUTES.diagnosticsOverview} element={<HealthCheckupsOverviewPage />} />
      <Route path={ROUTES.diagnosticsBookingSuccess} element={<BookingSuccessPage />} />

      {/* Legacy redirects */}
      <Route path="/health-checkups" element={<Navigate to="/Diagnostics/health-checkups" replace />} />
      <Route path="/health-checkups/add-family-member" element={<Navigate to="/Diagnostics/health-checkups/add-family-member" replace />} />
      <Route path="/health-checkups/plan" element={<Navigate to="/Diagnostics/health-checkups/plan" replace />} />
      <Route path="/health-checkups/diagnostics" element={<Navigate to="/Diagnostics/health-checkups/vendors" replace />} />
      <Route path="/health-checkups/diagnostics/slots" element={<Navigate to="/Diagnostics/health-checkups/slots" replace />} />
      <Route path="/health-checkups/overview" element={<Navigate to="/Diagnostics/health-checkups/overview" replace />} />
      <Route path="/health-checkups/booking-success" element={<Navigate to="/Diagnostics/health-checkups/booking-success" replace />} />

      {/* Consultation uses same initial pages */}
      <Route path={ROUTES.consultation} element={<HealthCheckupsPage />} />
      <Route path={ROUTES.consultationAddFamilyMember} element={<AddFamilyMemberPage />} />
      <Route path={ROUTES.consultationSpecialties} element={<ConsultationSpecialtiesPage />} />
      <Route path={ROUTES.consultationHospitalResults} element={<ConsultationHospitalResultsPage />} />
      <Route path={ROUTES.consultationHospitalSlots} element={<ConsultationAppointmentSlotsPage />} />
      <Route path={ROUTES.consultationHospitalOverview} element={<ConsultationAppointmentOverviewPage />} />
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
      <Route
        path={ROUTES.gymMembership}
        element={<GymMembershipPage />}
      />
      <Route path="*" element={<Navigate to={ROUTES.root} replace />} />
    </Routes>
  );
}
