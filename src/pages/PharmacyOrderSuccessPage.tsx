import { PHARMACY_IMAGES } from "@/assets/images/pharmacy";
import { ROUTES } from "@/constants";
import { Link, useLocation } from "react-router-dom";
import "./PharmacyPages.css";

type NavState = Readonly<{ returnPath?: string }>;

export function PharmacyOrderSuccessPage() {
  const location = useLocation();
  const hubReturn = (location.state as NavState | null)?.returnPath ?? ROUTES.dashboard;

  return (
    <div className="ph-page">
      <main className="ph-success">
        <h1 className="ph-success__title">Order Generated Successfully</h1>
        <p className="ph-success__sub">
          Your order placed successfully, you&apos;ll get a call from our team to verify and proceed further.
        </p>
        <div className="ph-success__illu" aria-hidden>
          <img src={PHARMACY_IMAGES.dialogSuccess} alt="" />
        </div>
      </main>
      <div className="ph-footer-btn">
        <Link to={hubReturn} className="ph-footer-btn__inner">
          Done
        </Link>
      </div>
    </div>
  );
}
