import { Navigate, Route, Routes } from "react-router-dom";
import { ROUTES } from "../constants";
import { ProfileMembersAddPage } from "@/pages/ProfileMembersAddPage";
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
import { AccountLinkPage } from "@/pages/AccountLinkPage";
import { LoginPage } from "../pages/LoginPage";
import { OtpPage } from "../pages/OtpPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { ServicesHubPage } from "../pages/ServicesHubPage";
import { GymMembershipPage } from "@/pages/GymMembershipPage";
import { GymMembershipSelectPeoplePage } from "@/pages/GymMembershipSelectPeoplePage";
import { GymMembershipConfigurePage } from "@/pages/GymMembershipConfigurePage";
import { GymMembershipOverviewPage } from "@/pages/GymMembershipOverviewPage";
import { GymSelectClinicPage } from "@/pages/GymSelectClinicPage";
import { SplashPage } from "@/pages/SplashPage";
import { CartOverviewPage } from "@/pages/CartOverviewPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ProfileAddressPage } from "@/pages/ProfileAddressPage";
import { ProfileAddressFormPage } from "@/pages/ProfileAddressFormPage";
import { ProfileBankPage } from "@/pages/ProfileBankPage";
import { ProfileBankFormPage } from "@/pages/ProfileBankFormPage";
import { ProfileBankViewPage } from "@/pages/ProfileBankViewPage";
import { ProfileMembersPage } from "@/pages/ProfileMembersPage";
import { ProfileSubscriptionsPage } from "@/pages/ProfileSubscriptionsPage";

/** Route table only — add screens here without touching `App` shell (OCP). */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.root} element={<SplashPage />} />
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.otp} element={<OtpPage />} />
      <Route path={ROUTES.accountLink} element={<AccountLinkPage />} />
      <Route path={ROUTES.dashboard} element={<HomePage />} />
      <Route path={ROUTES.profile} element={<ProfilePage />} />
      <Route path={ROUTES.profileBank} element={<ProfileBankPage />} />
      <Route path={ROUTES.profileBankAdd} element={<ProfileBankFormPage />} />
      <Route path={ROUTES.profileBankView} element={<ProfileBankViewPage />} />
      <Route path={ROUTES.profileBankEdit} element={<ProfileBankFormPage />} />
      <Route path={ROUTES.profileAddress} element={<ProfileAddressPage />} />
      <Route path={ROUTES.profileAddressAdd} element={<ProfileAddressFormPage />} />
      <Route path={ROUTES.profileAddressEdit} element={<ProfileAddressFormPage />} />
      <Route path={ROUTES.profileMembers} element={<ProfileMembersPage />} />
      <Route path={ROUTES.profileMembersAdd} element={<ProfileMembersAddPage />} />
      <Route path={ROUTES.profileMembersEdit} element={<ProfileMembersAddPage />} />
      <Route path={ROUTES.profileSubscriptions} element={<ProfileSubscriptionsPage />} />
      <Route path="/home" element={<Navigate to={ROUTES.dashboard} replace />} />
      <Route path={ROUTES.services} element={<ServicesHubPage />} />

      {/* Diagnostics flows (Health Checkups, Lab Tests, etc.) */}
      <Route path={ROUTES.diagnosticsType} element={<HealthCheckupsPage />} />
      <Route
        path={ROUTES.diagnosticsAddFamilyMember}
        element={<Navigate to={ROUTES.profileMembersAdd} replace />}
      />
      <Route path={ROUTES.diagnosticsPlan} element={<HealthCheckupsPlanPage />} />
      <Route path={ROUTES.diagnosticsVendors} element={<DiagnosticsScreenPage />} />
      <Route path={ROUTES.diagnosticsSlots} element={<DiagnosticsSlotsPage />} />
      <Route path={ROUTES.diagnosticsOverview} element={<HealthCheckupsOverviewPage />} />
      <Route path={ROUTES.diagnosticsBookingSuccess} element={<BookingSuccessPage />} />
      <Route path={ROUTES.cartOverview} element={<CartOverviewPage />} />

      {/* Legacy redirects */}
      <Route path="/health-checkups" element={<Navigate to="/Diagnostics/health-checkups" replace />} />
      <Route
        path="/health-checkups/add-family-member"
        element={<Navigate to={ROUTES.profileMembersAdd} replace />}
      />
      <Route path="/health-checkups/plan" element={<Navigate to="/Diagnostics/health-checkups/plan" replace />} />
      <Route path="/health-checkups/diagnostics" element={<Navigate to="/Diagnostics/health-checkups/vendors" replace />} />
      <Route path="/health-checkups/diagnostics/slots" element={<Navigate to="/Diagnostics/health-checkups/slots" replace />} />
      <Route path="/health-checkups/overview" element={<Navigate to="/Diagnostics/health-checkups/overview" replace />} />
      <Route path="/health-checkups/booking-success" element={<Navigate to="/Diagnostics/health-checkups/booking-success" replace />} />

      {/* Consultation uses same initial pages */}
      <Route path={ROUTES.consultation} element={<HealthCheckupsPage />} />
      <Route
        path={ROUTES.consultationAddFamilyMember}
        element={<Navigate to={ROUTES.profileMembersAdd} replace />}
      />
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
      <Route
        path={ROUTES.gymMembershipSelectPeople}
        element={<GymMembershipSelectPeoplePage />}
      />
      <Route
        path={ROUTES.gymMembershipConfigure}
        element={<GymMembershipConfigurePage />}
      />
      <Route
        path={ROUTES.gymMembershipOverview}
        element={<GymMembershipOverviewPage />}
      />
      <Route
        path={ROUTES.gymMembershipSelectClinic}
        element={<GymSelectClinicPage />}
      />
      <Route path="*" element={<Navigate to={ROUTES.login} replace />} />
    </Routes>
  );
}
