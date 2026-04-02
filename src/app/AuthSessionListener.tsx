import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_SESSION_EXPIRED_EVENT } from "@/lib/authStorage";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";

/** Reacts to 401 from patient API: storage cleared → toast and replace to login. */
export function AuthSessionListener() {
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const onExpired = () => {
      toast.info("Your session has ended. Please sign in again.");
      navigate(ROUTES.login, { replace: true });
    };
    globalThis.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onExpired);
    return () => globalThis.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onExpired);
  }, [navigate, toast]);

  return null;
}
