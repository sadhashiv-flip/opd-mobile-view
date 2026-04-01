import { ROUTES } from "@/constants";
import {
  GYM_OVERVIEW_SNAPSHOT_KEY,
  type GymOverviewSnapshot,
} from "@/constants/gymOverviewStorage";
import { GymBenefitsModal } from "@/components/gym/GymBenefitsModal";
import { GymRemoveMemberConfirmModal } from "@/components/gym/GymRemoveMemberConfirmModal";
import { GymTermsSheet } from "@/components/gym/GymTermsSheet";
import {
  GYM_MEMBERSHIP_PLANS,
  getGymMembershipTermsProductPhrase,
  getGymPlanPackageLabel,
  type GymMembershipPlan,
} from "@/constants/gymPlans";
import myOrdersSvg from "@/assets/icons/common/MyOrders.svg";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./HealthCheckupsOverviewPage.css";
import "./GymMembershipPage.css";
import "./GymMembershipConfigurePage.css";

function planAccentClass(accent: GymMembershipPlan["accent"]): string {
  if (accent === "gold") return " gym-plan-card--gold";
  if (accent === "orange") return " gym-plan-card--orange";
  return " gym-plan-card--blue";
}

const FAMILY_STORAGE_KEY = "opd-mobile-view.health-checkups.family";
const GYM_SELECTED_PERSON_KEY = "opd-mobile-view.gym-membership.selectedPersonId";
const GYM_PLAN_ID_KEY = "opd-mobile-view.gym-membership.planId";

type MemberRow = Readonly<{
  id: string;
  name: string;
  subtitle: string;
  section: "self" | "family";
  phone?: string;
  email?: string;
}>;

const SEED_MEMBERS: readonly MemberRow[] = [
  {
    id: "self-1",
    name: "Gundari Abhinay",
    subtitle: "sponsored by your company",
    section: "self",
    phone: "9876543210",
    email: "abhinay@email.com",
  },
  {
    id: "family-1",
    name: "Gundari Abhinay",
    subtitle: "Packages available",
    section: "family",
    phone: "9876543210",
    email: "xxxxxxx@email.com",
  },
];

function readStoredPlanId(): string | null {
  try {
    const p = localStorage.getItem(GYM_PLAN_ID_KEY);
    return p && p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

function loadMembers(): MemberRow[] {
  const fromStorage: MemberRow[] = [];
  try {
    const raw = localStorage.getItem(FAMILY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const m of parsed) {
          if (
            m &&
            typeof m === "object" &&
            "id" in m &&
            "name" in m &&
            "subtitle" in m &&
            typeof (m as { id: unknown }).id === "string" &&
            typeof (m as { name: unknown }).name === "string" &&
            typeof (m as { subtitle: unknown }).subtitle === "string"
          ) {
            const row = m as {
              id: string;
              name: string;
              subtitle: string;
              phone?: unknown;
            };
            fromStorage.push({
              id: row.id,
              name: row.name,
              subtitle: row.subtitle,
              section: "family",
              phone: typeof row.phone === "string" ? row.phone : "9876543210",
              email: "xxxxxxx@email.com",
            });
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return [...SEED_MEMBERS, ...fromStorage];
}

function PinIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 21s7-4.35 7-10a7 7 0 10-14 0c0 5.65 7 10 7 10z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type CardRole = "primary" | "secondary";

type GymMemberCardProps = Readonly<{
  role: CardRole;
  name: string;
  phone: string;
  email: string;
  cityChosen: boolean;
  packageChosen: boolean;
  packageLabel: string;
  onClose: () => void;
  showClose: boolean;
  onChooseCity: () => void;
  onChoosePackage: () => void;
  onCenterList: () => void;
}>;

function GymMemberConfigureCard({
  role,
  name,
  phone,
  email,
  cityChosen,
  packageChosen,
  packageLabel,
  onClose,
  showClose,
  onChooseCity,
  onChoosePackage,
  onCenterList,
}: GymMemberCardProps) {
  const bandLabel = role === "primary" ? "Primary" : "Secondary";
  const cardClass =
    role === "primary" ? "gmc-card gmc-card--primary" : "gmc-card gmc-card--secondary";

  return (
    <article className={cardClass}>
      {showClose ? (
        <button type="button" className="gmc-card__close" onClick={onClose} aria-label={`Remove ${bandLabel}`}>
          ×
        </button>
      ) : null}
      <div className="gmc-card__inner">
        <div className="gmc-card__body">
          <div className="gmc-card__row">
            <span className="gmc-card__label">Name</span>
            <span className="gmc-card__sep" aria-hidden="true">
              :
            </span>
            <span className="gmc-card__value">{name}</span>
          </div>
          <div className="gmc-card__row">
            <span className="gmc-card__label">Phone</span>
            <span className="gmc-card__sep" aria-hidden="true">
              :
            </span>
            <span className="gmc-card__value">{phone}</span>
          </div>
          <div className="gmc-card__row">
            <span className="gmc-card__label">Email</span>
            <span className="gmc-card__sep" aria-hidden="true">
              :
            </span>
            <span className="gmc-card__value">{email}</span>
          </div>
          <div className="gmc-card__row">
            <span className="gmc-card__label">City</span>
            <span className="gmc-card__sep" aria-hidden="true">
              :
            </span>
            {cityChosen ? (
              <span className="gmc-card__value">Indiranagar, Bengaluru</span>
            ) : (
              <button type="button" className="gmc-card__link" onClick={onChooseCity}>
                Choose Location
              </button>
            )}
          </div>
          <div className="gmc-card__row gmc-card__row--package">
            <span className="gmc-card__label">Package</span>
            <span className="gmc-card__sep" aria-hidden="true">
              :
            </span>
            <div className="gmc-card__package-line">
              <div className="gmc-card__package-value">
                {packageChosen ? (
                  <span className="gmc-card__value">{packageLabel}</span>
                ) : (
                  <button type="button" className="gmc-card__link" onClick={onChoosePackage}>
                    Select Package
                  </button>
                )}
              </div>
              <button type="button" className="gmc-card__center-list" onClick={onCenterList}>
                <PinIcon className="gmc-card__center-list-pin" />
                Center List
              </button>
            </div>
          </div>
        </div>
        <div className="gmc-card__band">
          <ShieldIcon className="gmc-card__band-shield" />
          <span className="gmc-card__band-label">{bandLabel}</span>
        </div>
      </div>
    </article>
  );
}

export function GymMembershipConfigurePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const statePlanId =
    typeof (location.state as { planId?: unknown } | null)?.planId === "string"
      ? (location.state as { planId: string }).planId
      : null;
  const planId = statePlanId ?? readStoredPlanId();

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showSecondary, setShowSecondary] = useState(true);
  const [primaryCity, setPrimaryCity] = useState(false);
  const [secondaryCity, setSecondaryCity] = useState(false);
  const [primaryMemberPlanId, setPrimaryMemberPlanId] = useState<string | null>(null);
  const [secondaryMemberPlanId, setSecondaryMemberPlanId] = useState<string | null>(null);
  const [packageSheetTarget, setPackageSheetTarget] = useState<"primary" | "secondary" | null>(
    null,
  );
  const [sheetPlanId, setSheetPlanId] = useState<string | null>(null);
  const [benefitsPlan, setBenefitsPlan] = useState<GymMembershipPlan | null>(null);
  const [termsSheetOpen, setTermsSheetOpen] = useState(false);
  const [removeConfirmTarget, setRemoveConfirmTarget] = useState<"primary" | "secondary" | null>(
    null,
  );

  const selectedPersonId = useMemo(() => {
    try {
      return localStorage.getItem(GYM_SELECTED_PERSON_KEY);
    } catch {
      return null;
    }
  }, []);

  const { primaryMember, secondaryMember } = useMemo(() => {
    const all = loadMembers();
    const primary =
      all.find((m) => m.id === selectedPersonId) ?? all[0] ?? SEED_MEMBERS[0];
    const secondary =
      all.find((m) => m.id !== primary.id) ?? all[1] ?? SEED_MEMBERS[1];
    return { primaryMember: primary, secondaryMember: secondary };
  }, [selectedPersonId]);

  const primaryPackageLabel = useMemo(
    () => getGymPlanPackageLabel(primaryMemberPlanId),
    [primaryMemberPlanId],
  );
  const secondaryPackageLabel = useMemo(
    () => getGymPlanPackageLabel(secondaryMemberPlanId),
    [secondaryMemberPlanId],
  );

  const termsMembershipPhrase = useMemo(
    () => getGymMembershipTermsProductPhrase(primaryMemberPlanId ?? planId),
    [primaryMemberPlanId, planId],
  );

  useEffect(() => {
    if (!planId) {
      navigate(ROUTES.gymMembership, { replace: true });
    }
  }, [planId, navigate]);

  useEffect(() => {
    if (!selectedPersonId) {
      navigate(ROUTES.gymMembershipSelectPeople, {
        replace: true,
        state: planId ? { planId } : undefined,
      });
    }
  }, [selectedPersonId, planId, navigate]);

  // Default each member's package to the plan already chosen on the plans screen so
  // Continue can enable after terms — users can still change packages via Select Package.
  useEffect(() => {
    if (!planId) return;
    if (!GYM_MEMBERSHIP_PLANS.some((p) => p.id === planId)) return;
    setPrimaryMemberPlanId((prev) => (prev === null ? planId : prev));
    setSecondaryMemberPlanId((prev) => (prev === null ? planId : prev));
  }, [planId]);

  const packagesReady =
    primaryMemberPlanId !== null &&
    (!showSecondary || secondaryMemberPlanId !== null);
  const canContinue = termsAccepted && packagesReady;

  const backState = planId ? { planId } : undefined;

  const closePackageSheet = useCallback(() => {
    setPackageSheetTarget(null);
  }, []);

  const openPackageSheet = useCallback(
    (target: "primary" | "secondary") => {
      setPackageSheetTarget(target);
      const existing = target === "primary" ? primaryMemberPlanId : secondaryMemberPlanId;
      const fallback = planId ?? GYM_MEMBERSHIP_PLANS[0]?.id ?? null;
      setSheetPlanId(existing ?? fallback);
    },
    [primaryMemberPlanId, secondaryMemberPlanId, planId],
  );

  const confirmPackageSheet = useCallback(() => {
    if (!sheetPlanId || !packageSheetTarget) return;
    if (packageSheetTarget === "primary") {
      setPrimaryMemberPlanId(sheetPlanId);
    } else {
      setSecondaryMemberPlanId(sheetPlanId);
    }
    setPackageSheetTarget(null);
  }, [sheetPlanId, packageSheetTarget]);

  useEffect(() => {
    if (!packageSheetTarget) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [packageSheetTarget]);

  useEffect(() => {
    if (!packageSheetTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPackageSheetTarget(null);
      }
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [packageSheetTarget]);

  const onCenterList = useCallback(() => {
    navigate(ROUTES.gymMembershipSelectClinic, { state: backState });
  }, [navigate, backState]);

  const confirmRemoveMember = useCallback(() => {
    if (removeConfirmTarget === "primary") {
      navigate(ROUTES.gymMembershipSelectPeople, { state: backState });
    } else if (removeConfirmTarget === "secondary") {
      setShowSecondary(false);
    }
    setRemoveConfirmTarget(null);
  }, [removeConfirmTarget, navigate, backState]);

  if (!planId || !selectedPersonId) {
    return null;
  }

  return (
    <div className="gmc-page">
      <header className="hco-top">
        <Link
          to={ROUTES.gymMembershipSelectPeople}
          state={backState}
          className="hco-back"
          aria-label="Back to member selection"
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
        </Link>
        <h1 className="hco-title">Gym Membership</h1>
        <Link to={ROUTES.orders} className="hco-orders">
          <span className="hco-orders__ic" aria-hidden="true">
            <img src={myOrdersSvg} alt="" width={14} height={14} draggable={false} />
          </span>
          My Orders
        </Link>
      </header>

      <main className="gmc-main">
        <div className="gmc-cards">
          <GymMemberConfigureCard
            role="primary"
            name={primaryMember.name}
            phone={primaryMember.phone ?? "9876543210"}
            email={primaryMember.email ?? "xxxxxxx@email.com"}
            cityChosen={primaryCity}
            packageChosen={primaryMemberPlanId !== null}
            packageLabel={primaryPackageLabel}
            showClose
            onClose={() => setRemoveConfirmTarget("primary")}
            onChooseCity={() => setPrimaryCity(true)}
            onChoosePackage={() => openPackageSheet("primary")}
            onCenterList={onCenterList}
          />
          {showSecondary ? (
            <GymMemberConfigureCard
              role="secondary"
              name={secondaryMember.name}
              phone={secondaryMember.phone ?? "9876543210"}
              email={secondaryMember.email ?? "xxxxxxx@email.com"}
              cityChosen={secondaryCity}
              packageChosen={secondaryMemberPlanId !== null}
              packageLabel={secondaryPackageLabel}
              showClose
              onClose={() => setRemoveConfirmTarget("secondary")}
              onChooseCity={() => setSecondaryCity(true)}
              onChoosePackage={() => openPackageSheet("secondary")}
              onCenterList={onCenterList}
            />
          ) : null}
        </div>
      </main>

      <footer className="gmc-footer">
        <label className="gmc-terms">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => {
              if (e.target.checked) {
                setTermsSheetOpen(true);
                return;
              }
              setTermsAccepted(false);
            }}
          />
          <span className="gmc-terms__text">
            Please accept all the{" "}
            <button
              type="button"
              className="gmc-terms__link"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTermsSheetOpen(true);
              }}
            >
              Terms &amp; Conditions
            </button>
          </span>
        </label>
        <button
          type="button"
          className="gmc-continue"
          disabled={!canContinue}
          onClick={() => {
            if (!primaryMemberPlanId) return;
            if (showSecondary && !secondaryMemberPlanId) return;
            const snapshot: GymOverviewSnapshot = {
              planId,
              primaryUserName: primaryMember.name,
              primaryUserEmail:
                primaryMember.email ??
                `${primaryMember.name.replaceAll(/\s+/g, "").toLowerCase()}@email.com`,
              showSecondary,
              primary: {
                role: "primary",
                name: primaryMember.name,
                phone: primaryMember.phone ?? "9876543210",
                email: primaryMember.email ?? "xxxxxxx@email.com",
                cityChosen: primaryCity,
                planId: primaryMemberPlanId,
              },
              secondary:
                showSecondary && secondaryMemberPlanId
                  ? {
                      role: "secondary",
                      name: secondaryMember.name,
                      phone: secondaryMember.phone ?? "9876543210",
                      email: secondaryMember.email ?? "xxxxxxx@email.com",
                      cityChosen: secondaryCity,
                      planId: secondaryMemberPlanId,
                    }
                  : null,
            };
            try {
              sessionStorage.setItem(GYM_OVERVIEW_SNAPSHOT_KEY, JSON.stringify(snapshot));
            } catch {
              // ignore storage errors
            }
            navigate(ROUTES.gymMembershipOverview);
          }}
        >
          Continue
        </button>
      </footer>

      {packageSheetTarget ? (
        <div
          className="gmc-pkg-sheet-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gmc-pkg-sheet-title"
        >
          <button
            type="button"
            className="gmc-pkg-sheet-backdrop"
            aria-label="Close"
            onClick={closePackageSheet}
          />
          <div className="gmc-pkg-sheet">
            <header className="gmc-pkg-sheet__header">
              <h2 id="gmc-pkg-sheet-title" className="gmc-pkg-sheet__title">
                Select Package
              </h2>
              <button
                type="button"
                className="gmc-pkg-sheet__close"
                onClick={closePackageSheet}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="gmc-pkg-sheet__body">
              <div className="gym-plan-list">
                {GYM_MEMBERSHIP_PLANS.map((plan) => {
                  const isChecked = sheetPlanId === plan.id;
                  const selectedClass = isChecked ? " gym-plan-card--selected" : "";
                  const accentClass = planAccentClass(plan.accent);
                  const overlayClass =
                    plan.accent === "blue"
                      ? "gym-plan-card__overlay--blue"
                      : "gym-plan-card__overlay--black";
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      className={`gym-plan-card${selectedClass}${accentClass}`}
                      onClick={() => setSheetPlanId(plan.id)}
                    >
                      <span
                        className="gym-plan-card__background"
                        style={{ backgroundImage: `url(${plan.image})` }}
                        aria-hidden="true"
                      />
                      <span className={`gym-plan-card__overlay ${overlayClass}`} aria-hidden="true" />
                      <span
                        className={`gym-plan-card__check ${isChecked ? "gym-plan-card__check--active" : ""}`}
                        aria-hidden="true"
                      >
                        {isChecked ? "✔" : ""}
                      </span>
                      <div className="gym-plan-card__content">
                        <div className="gym-plan-card__info">
                          <div className="gym-plan-card__tier">
                            <span className="gym-plan-card__tier-text">Cult</span>
                            <span className="gym-plan-card__tier-highlight">
                              {plan.tier.split(" ")[1]}
                            </span>
                            <span className="gym-plan-card__tier-text">Membership</span>
                          </div>
                          <div className="gym-plan-card__term">{plan.months} Months</div>
                          <div className="gym-plan-card__pricing">
                            <del className="gym-plan-card__old-price">
                              ₹{plan.oldPrice.toLocaleString()}+
                            </del>
                            <div className="gym-plan-card__price">
                              ₹{plan.price.toLocaleString()}
                              <span className="gym-plan-card__price-suffix">/per person</span>
                            </div>
                            <div className="gym-plan-card__tax-label">{plan.taxFeesLabel}</div>
                          </div>
                        </div>
                      </div>
                      <div className="gym-plan-card__meta mb-4">
                        <button
                          type="button"
                          className="gym-plan-card__benefits"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBenefitsPlan(plan);
                          }}
                        >
                          View Benefits
                        </button>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <footer className="gmc-pkg-sheet__footer">
              <button
                type="button"
                className="gmc-pkg-sheet__proceed"
                disabled={sheetPlanId === null}
                onClick={confirmPackageSheet}
              >
                Proceed
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      <GymBenefitsModal plan={benefitsPlan} onClose={() => setBenefitsPlan(null)} />

      <GymTermsSheet
        open={termsSheetOpen}
        membershipPhrase={termsMembershipPhrase}
        onClose={() => setTermsSheetOpen(false)}
        onAccept={() => setTermsAccepted(true)}
      />

      <GymRemoveMemberConfirmModal
        open={removeConfirmTarget !== null}
        onCancel={() => setRemoveConfirmTarget(null)}
        onConfirm={confirmRemoveMember}
      />
    </div>
  );
}
