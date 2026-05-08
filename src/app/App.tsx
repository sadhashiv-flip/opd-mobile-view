import { FcmForegroundListener } from "@/components/fcm/FcmForegroundListener";
import { ApiLoadingOverlay } from "@/components/apiLoading/ApiLoadingOverlay";
import { AppConfirmProvider } from "@/components/dialog/AppConfirmDialog";
import { MobileShell } from "@/components/layout/MobileShell";
import { ToastProvider } from "@/components/toast";
import { AuthSessionListener } from "./AuthSessionListener";
import { AppRoutes } from "./AppRoutes";

export default function App() {
  return (
    <ToastProvider>
      <AppConfirmProvider>
        <MobileShell>
          <FcmForegroundListener />
          <AuthSessionListener />
          <div className="mobile-frame__routes">
            <AppRoutes />
          </div>
          <ApiLoadingOverlay />
        </MobileShell>
      </AppConfirmProvider>
    </ToastProvider>
  );
}
