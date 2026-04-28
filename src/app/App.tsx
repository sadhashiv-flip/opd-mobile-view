import { FcmForegroundListener } from "@/components/fcm/FcmForegroundListener";
import { ApiLoadingOverlay } from "@/components/apiLoading/ApiLoadingOverlay";
import { MobileShell } from "@/components/layout/MobileShell";
import { ToastProvider } from "@/components/toast";
import { AuthSessionListener } from "./AuthSessionListener";
import { AppRoutes } from "./AppRoutes";

export default function App() {
  return (
    <ToastProvider>
      <MobileShell>
        <FcmForegroundListener />
        <AuthSessionListener />
        <AppRoutes />
        <ApiLoadingOverlay />
      </MobileShell>
    </ToastProvider>
  );
}
