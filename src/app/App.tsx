import { MobileShell } from "@/components/layout/MobileShell";
import { ToastProvider } from "@/components/toast";
import { AuthSessionListener } from "./AuthSessionListener";
import { AppRoutes } from "./AppRoutes";

export default function App() {
  return (
    <ToastProvider>
      <MobileShell>
        <AuthSessionListener />
        <AppRoutes />
      </MobileShell>
    </ToastProvider>
  );
}
