import { Navigate, Route, Routes } from "react-router-dom";
import { ROUTES } from "@/constants";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { OtpPage } from "@/pages/OtpPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { ServicesHubPage } from "@/pages/ServicesHubPage";
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
