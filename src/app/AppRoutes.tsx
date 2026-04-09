import { Navigate, Route, Routes } from "react-router-dom";
import { ROUTES } from "../constants";
import { ProfileMembersAddPage } from "@/pages/ProfileMembersAddPage";
import { BookingSuccessPage } from "../pages/BookingSuccessPage";
import { ConsultationAppointmentSlotsPage } from "../pages/ConsultationAppointmentSlotsPage";
import { ConsultationAppointmentOverviewPage } from "../pages/ConsultationAppointmentOverviewPage";
import { DiagnosticsScreenPage } from "../pages/DiagnosticsScreenPage";
import { DiagnosticsSlotsPage } from "../pages/DiagnosticsSlotsPage";
import { ConsultationSpecialtiesPage } from "../pages/ConsultationSpecialtiesPage";
import { ConsultationVirtualSlotsPage } from "../pages/ConsultationVirtualSlotsPage";
import { HealthCheckupsOverviewPage } from "../pages/HealthCheckupsOverviewPage";
import { HealthCheckupsPlanPage } from "../pages/HealthCheckupsPlanPage";
import { HomePage } from "../pages/HomePage";
import { AccountLinkPage } from "@/pages/AccountLinkPage";
import { LoginPage } from "../pages/LoginPage";
import { OtpPage } from "../pages/OtpPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { ServicesHubPage } from "../pages/ServicesHubPage";
import { SupportTicketChatPage } from "@/pages/SupportTicketChatPage";
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
import { ConsultationVirtualAppointmentOverviewPage } from "@/pages/ConsultationVirtualAppointmentOverviewPage";
import {
  ConsultationSelectPeoplePage,
  DentalSelectPeoplePage,
  DiagnosticsSelectPeoplePage,
  VisionSelectPeoplePage,
} from "@/pages/ConsultationSelectPeoplePage";
import { DentalNetworkListPage } from "@/pages/DentalNetworkListPage";
import { VisionNetworkListPage } from "@/pages/VisionNetworkListPage";
import { DentalSlotsPage } from "@/pages/DentalSlotsPage";
import { DentalOverviewPage } from "@/pages/DentalOverviewPage";
import { ConsultationEntryRedirect } from "@/app/ConsultationEntryRedirect";
import { DiagnosticsEntryRedirect } from "@/app/DiagnosticsEntryRedirect";
import { UserDetailsPersonalInfoPage } from "@/pages/UserDetailsPersonalInfoPage";
import { UserDetailsBmiPage } from "@/pages/UserDetailsBmiPage";
import { UserDetailsBmiResultPage } from "@/pages/UserDetailsBmiResultPage";
import { ConsultationTypePage } from "../pages/ConsultationTypePage";
import { ConsultationHospitalResultsPage } from "@/pages/ConsultationHospitalResultsPage";
import { WellnessSessionPage } from "@/pages/WellnessSessionPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { OrderDetailsPage } from "@/pages/OrderDetailsPage";
import { VaccinationSelectPeoplePage } from "@/pages/VaccinationSelectPeoplePage";
import { VaccinationChooseTypePage } from "@/pages/VaccinationChooseTypePage";
import { VaccinationSlotsPage } from "@/pages/VaccinationSlotsPage";
import { VaccinationOverviewPage } from "@/pages/VaccinationOverviewPage";
import { PharmacyDeliveryPage } from "@/pages/PharmacyDeliveryPage";
import { PharmacyUploadPage } from "@/pages/PharmacyUploadPage";
import { PharmacySelectPrescriptionPage } from "@/pages/PharmacySelectPrescriptionPage";
import { PharmacyPrescriptionDetailPage } from "@/pages/PharmacyPrescriptionDetailPage";
import { PharmacyOrderSuccessPage } from "@/pages/PharmacyOrderSuccessPage";
import { WalletRedirectPage } from "@/pages/WalletRedirectPage";
import { WalletPage } from "@/pages/WalletPage";
import { WalletAllTransactionsPage } from "@/pages/WalletAllTransactionsPage";

/** Route table only — add screens here without touching `App` shell (OCP). */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.root} element={<SplashPage />} />
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.otp} element={<OtpPage />} />
      <Route path={ROUTES.userDetailsPersonal} element={<UserDetailsPersonalInfoPage />} />
      <Route path={ROUTES.userDetailsBmi} element={<UserDetailsBmiPage />} />
      <Route path={ROUTES.userDetailsBmiResult} element={<UserDetailsBmiResultPage />} />
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
      <Route path={ROUTES.servicesSupportTicketChat} element={<SupportTicketChatPage />} />

      {/* Diagnostics flows (Health Checkups, Lab Tests, etc.) */}
      <Route path={ROUTES.diagnosticsType} element={<DiagnosticsEntryRedirect />} />
      <Route path={ROUTES.diagnosticsSelectPeople} element={<DiagnosticsSelectPeoplePage />} />
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
      <Route path="/health-checkups" element={<Navigate to="/diagnostics/health-checkups" replace />} />
      <Route
        path="/health-checkups/add-family-member"
        element={<Navigate to={ROUTES.profileMembersAdd} replace />}
      />
      <Route path="/health-checkups/plan" element={<Navigate to="/diagnostics/health-checkups/plan" replace />} />
      <Route path="/health-checkups/diagnostics" element={<Navigate to="/diagnostics/health-checkups/vendors" replace />} />
      <Route path="/health-checkups/diagnostics/slots" element={<Navigate to="/diagnostics/health-checkups/slots" replace />} />
      <Route path="/health-checkups/overview" element={<Navigate to="/diagnostics/health-checkups/overview" replace />} />
      <Route path="/health-checkups/booking-success" element={<Navigate to="/diagnostics/health-checkups/booking-success" replace />} />

      {/* Consultation: static paths before `/consultation/:type` entry */}
      <Route path={ROUTES.consultationType} element={<ConsultationTypePage />} />
      <Route path={ROUTES.consultation} element={<ConsultationEntryRedirect />} />
      <Route
        path={ROUTES.consultationAddFamilyMember}
        element={<Navigate to={ROUTES.profileMembersAdd} replace />}
      />
      <Route path={ROUTES.consultationSelectPeople} element={<ConsultationSelectPeoplePage />} />
      <Route path={ROUTES.consultationSpecialties} element={<ConsultationSpecialtiesPage />} />
      <Route path={ROUTES.consultationVirtualSlots} element={<ConsultationVirtualSlotsPage />} />
      <Route path={ROUTES.consultationVirtualOverview} element={<ConsultationVirtualAppointmentOverviewPage />} />
      <Route path={ROUTES.consultationHospitalResults} element={<ConsultationHospitalResultsPage />} />
      <Route path={ROUTES.consultationHospitalSlots} element={<ConsultationAppointmentSlotsPage />} />
      <Route path={ROUTES.consultationHospitalOverview} element={<ConsultationAppointmentOverviewPage />} />
      <Route path={ROUTES.consultationHospitalBookingSuccess} element={<BookingSuccessPage />} />
      <Route path={ROUTES.consultationVirtualBookingSuccess} element={<BookingSuccessPage />} />
      <Route path={ROUTES.dentalSelectPeople} element={<DentalSelectPeoplePage />} />
      <Route path={ROUTES.visionSelectPeople} element={<VisionSelectPeoplePage />} />
      <Route path={ROUTES.visionNetworkList} element={<VisionNetworkListPage />} />
      <Route path={ROUTES.dentalNetworkList} element={<DentalNetworkListPage />} />
      <Route path={ROUTES.dentalSlots} element={<DentalSlotsPage />} />
      <Route path={ROUTES.dentalOverview} element={<DentalOverviewPage />} />
      <Route path={ROUTES.dentalBookingSuccess} element={<BookingSuccessPage />} />
      <Route path={ROUTES.bookingSuccess} element={<BookingSuccessPage />} />
      <Route path={ROUTES.dental} element={<PlaceholderPage title="Dental" />} />
      <Route path={ROUTES.vision} element={<PlaceholderPage title="Vision" />} />
      <Route path={ROUTES.pharmacy} element={<PharmacyDeliveryPage />} />
      <Route path={ROUTES.pharmacyUpload} element={<PharmacyUploadPage />} />
      <Route path={ROUTES.pharmacySelectPrescription} element={<PharmacySelectPrescriptionPage />} />
      <Route path={ROUTES.pharmacyPrescriptionDetail} element={<PharmacyPrescriptionDetailPage />} />
      <Route path={ROUTES.pharmacyOrderSuccess} element={<PharmacyOrderSuccessPage />} />
      <Route path={ROUTES.ordersDetail} element={<OrderDetailsPage />} />
      <Route path={ROUTES.orders} element={<OrdersPage />} />
      <Route path={ROUTES.walletTransactions} element={<WalletAllTransactionsPage />} />
      <Route path={ROUTES.walletSubscription} element={<WalletPage />} />
      <Route path={ROUTES.wallet} element={<WalletRedirectPage />} />
      <Route path={ROUTES.help} element={<Navigate to={ROUTES.servicesHelpTab} replace />} />
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
      <Route path={ROUTES.vaccinationSelectPeople} element={<VaccinationSelectPeoplePage />} />
      <Route path={ROUTES.vaccinationChooseType} element={<VaccinationChooseTypePage />} />
      <Route path={ROUTES.vaccinationSlots} element={<VaccinationSlotsPage />} />
      <Route path={ROUTES.vaccinationOverview} element={<VaccinationOverviewPage />} />
      <Route path={ROUTES.servicesWellness} element={<WellnessSessionPage />} />
      <Route path="*" element={<Navigate to={ROUTES.login} replace />} />
    </Routes>
  );
}
