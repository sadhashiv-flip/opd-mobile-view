import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import {
  fetchActiveSubscriptions,
  type ActiveSubscriptionItem,
} from "@/api/patientSubscriptions";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import "./ProfileManagePage.css";
import "./ProfileSubscriptionsPage.css";

function formatInr(amount: number | null): string | null {
  if (amount == null || Number.isNaN(amount)) return null;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function PatientAvatarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 11a3 3 0 100-6 3 3 0 000 6zM5 20a7 7 0 0114 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M8 14c-1.5 2-2 4-2 6h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="currentColor"
        fillOpacity="0.25"
      />
    </svg>
  );
}

export function ProfileSubscriptionsPage() {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    if (location.state?.returnPath) {
      navigate(location.state.returnPath);
    } else {
      navigate(ROUTES.profile);
    }
  }, [location.state, navigate]);
  const [items, setItems] = useState<readonly ActiveSubscriptionItem[]>([]);
  const [apiMessage, setApiMessage] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchActiveSubscriptions();
      setItems(res.items);
      setApiMessage(res.message);
      setIsSubscribed(res.isSubscribed);
    } catch (e) {
      setItems([]);
      setApiMessage(null);
      setIsSubscribed(false);
      setError(e instanceof Error ? e.message : "Could not load subscriptions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, location.key]);

  const onActivate = (sub: ActiveSubscriptionItem) => {
    if (!sub.canActivate) return;
    toast.info("Activation will be available when your plan supports it.");
  };

  return (
    <div className="profile-manage-page">
      <header className="profile-manage-page__top">
        <button
          type="button"
          onClick={handleBack}
          className="profile-manage-page__back"
          aria-label="Back"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="profile-manage-page__title">Subscriptions</h1>
        <span className="profile-manage-page__spacer" aria-hidden />
      </header>

      <main className="profile-manage-page__main">
        

        {loading ? (
          <div className="profile-sub-skeleton" aria-busy="true">
            <div className="profile-sub-skeleton__card profile-sub-skeleton__card--tall" />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="profile-manage-page__card profile-sub-error">
            <p className="profile-sub-error__text">{error}</p>
            <button type="button" className="profile-manage-page__save" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && apiMessage ? (
          <p className="profile-sub-v2-message">{apiMessage}</p>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div className="profile-manage-page__card profile-sub-empty">
            <p className="profile-sub-empty__text">
              {isSubscribed
                ? "No subscription details were returned."
                : "You do not have an active subscription."}
            </p>
          </div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <ul className="profile-sub-v2-list" aria-label="Active subscriptions">
            {items.map((sub) => (
              <li key={sub.id} className="profile-sub-plan-card">
                <div className="profile-sub-plan-card__top">
                  <h2 className="profile-sub-plan-card__title">{sub.planName}</h2>
                  <button
                    type="button"
                    className="profile-sub-plan-card__activate"
                    disabled={sub.canActivate !== true}
                    onClick={() => onActivate(sub)}
                  >
                    Activate
                  </button>
                </div>
                {typeof sub.membersCount === "number" ? (
                  <p className="profile-sub-plan-card__members">
                    Applicable for {sub.membersCount} member
                    {sub.membersCount === 1 ? "" : "s"}
                  </p>
                ) : null}
                {sub.memberTypeLine ? (
                  <p className="profile-sub-plan-card__types">{sub.memberTypeLine}</p>
                ) : null}
                {typeof sub.planAmount === "number" ? (
                  <p className="profile-sub-plan-card__price">{formatInr(sub.planAmount)}</p>
                ) : null}
                {typeof sub.daysLeft === "number" ? (
                  <p className="profile-sub-plan-card__days">{sub.daysLeft} days left</p>
                ) : null}
                {sub.patients.length > 0 ? (
                  <ul className="profile-sub-plan-card__patients">
                    {sub.patients.map((p) => (
                      <li key={p.id} className="profile-sub-patient">
                        <div className="profile-sub-patient__avatar" aria-hidden>
                          <PatientAvatarIcon />
                        </div>
                        <div className="profile-sub-patient__main">
                          <p className="profile-sub-patient__name">{p.name}</p>
                          <p className="profile-sub-patient__meta">
                            {p.genderLabel}
                            {typeof p.age === "number" ? ` / ${p.age}` : ""}
                          </p>
                        </div>
                        {p.isActive ? (
                          <span className="profile-sub-patient__status">Active</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </main>

      <HomeBottomNav />
    </div>
  );
}
