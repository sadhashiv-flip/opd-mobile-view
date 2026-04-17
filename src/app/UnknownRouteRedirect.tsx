import { getAuthSession } from "@/lib/authStorage";
import { ROUTES } from "@/constants";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

/**
 * Unknown paths: send authenticated users to the dashboard instead of the login screen.
 */
export function UnknownRouteRedirect() {
  const [to, setTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAuthSession().then((s) => {
      if (cancelled) return;
      setTo(s?.token ? ROUTES.dashboard : ROUTES.login);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!to) return null;
  return <Navigate to={to} replace />;
}
