import Lottie from "lottie-react";
import { Link, useNavigate } from "react-router-dom";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import { ROUTES } from "@/constants";
import successLottie from "@/assets/lotties/success.json";
import "./ProfileManagePage.css";

export function ProfileMembersAddSuccessPage() {
  const navigate = useNavigate();
  const mod = useProfileModuleGates();
  const showSubscriptionPath = mod.gateOk;

  return (
    <div className="profile-manage-page family-member-success">
      <main className="family-member-success__main">
        <h1 className="family-member-success__title">Member added successfully</h1>
        <p className="family-member-success__body">
          Your family member has been saved. You can activate them on your plan from
          Subscriptions when slots are available.
        </p>
        <div className="family-member-success__lottie" aria-hidden>
          <Lottie animationData={successLottie} loop={false} />
        </div>
      </main>

      <footer className="family-member-success__footer">
        {showSubscriptionPath ? (
          <>
            <Link
              to={ROUTES.profileSubscriptions}
              className="profile-manage-page__save family-member-success__primary"
            >
              Continue to subscriptions →
            </Link>
            <button
              type="button"
              className="family-member-success__secondary"
              onClick={() => navigate(ROUTES.profileMembers, { replace: true })}
            >
              Done
            </button>
          </>
        ) : (
          <button
            type="button"
            className="profile-manage-page__save family-member-success__primary"
            onClick={() => navigate(ROUTES.profileMembers, { replace: true })}
          >
            Done
          </button>
        )}
      </footer>

      <HomeBottomNav />
    </div>
  );
}
