import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AUTH_SESSION_EXPIRED_EVENT } from "@/lib/authStorage";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";

const AUTH_ROUTE_PREFIXES = [
  ROUTES.login,
  ROUTES.ssoLogin,
  ROUTES.otp,
  ROUTES.root,
] as const;

function isPublicAuthRoute(pathname: string): boolean {
  return AUTH_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Global handler for session expiry: `patientFetch` / `patientJson` clear storage on 401 and emit
 * `auth:session-expired`. We toast and replace to login unless already on a pre-auth screen.
 */
export function AuthSessionListener() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  useEffect(() => {
    const onExpired = () => {
      if (isPublicAuthRoute(location.pathname)) return;
      toast.info("Your session has ended. Please sign in again.");
      navigate(ROUTES.login, { replace: true });
    };
    globalThis.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onExpired);
    return () => globalThis.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onExpired);
  }, [navigate, toast, location.pathname]);

  return null;
}
