import { Navigate, useLocation } from "react-router-dom";
import { ROUTES } from "@/constants";

/** Legacy at-hospital / virtual consult success URLs → unified `/services/booking-success`. */
export function BookingSuccessCanonicalRedirect() {
  const location = useLocation();
  return <Navigate to={ROUTES.bookingSuccess} replace state={location.state} />;
}
