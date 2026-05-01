import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import {
  activateMemberOnPlan,
  fetchActiveSubscriptions,
  sortSubscriptionMemberTypeKeys,
  type ActiveSubscriptionItem,
  type ActiveSubscriptionPatientRow,
} from "@/api/patientSubscriptions";
import { fetchAllPatientMembers, type MemberDisplay } from "@/api/patientMember";
import { ROUTES } from "@/constants";
import { getAuthSession } from "@/lib/authStorage";
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

function friendlySlotType(rawKey: string): string {
  const k = rawKey.trim().toLowerCase();
  switch (k) {
    case "employee":
      return "Primary member";
    case "spouse":
      return "Spouse";
    case "child":
      return "Child";
    case "parent":
      return "Parent";
    default:
      if (!rawKey.length) return "Member";
      return rawKey[0].toUpperCase() + rawKey.slice(1).toLowerCase();
  }
}

function countPatientsForType(
  patients: readonly ActiveSubscriptionPatientRow[],
  typeKey: string,
): number {
  return patients.filter((p) => p.dependentType?.toString() === typeKey).length;
}

function totalMemberSlots(mt: Record<string, number> | null): number {
  if (!mt) return 0;
  let t = 0;
  for (const v of Object.values(mt)) {
    t += v;
  }
  return t;
}

function canUseEmptySlot(item: ActiveSubscriptionItem, primaryUserId: number | null): boolean {
  if (!item.planAllowsDependentAdd) return false;
  if (primaryUserId == null) return false;
  if (item.canActivate !== true) return false;
  if (item.patientId == null) return false;
  return item.patientId === String(primaryUserId);
}

type PickerState = Readonly<{
  subscriptionId: string;
  dependentTypeKey: string;
  typeLabel: string;
}>;

type ConfirmState = Readonly<{
  memberName: string;
  memberNumericId: number;
  subscriptionId: string;
  dependentType: string;
  slotLabel: string;
}>;

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

  const [primaryUserId, setPrimaryUserId] = useState<number | null>(null);
  const [items, setItems] = useState<readonly ActiveSubscriptionItem[]>([]);
  const [apiMessage, setApiMessage] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [picker, setPicker] = useState<PickerState | null>(null);
  const [pickerMembers, setPickerMembers] = useState<readonly MemberDisplay[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [activating, setActivating] = useState(false);

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
    void getAuthSession().then((s) => {
      setPrimaryUserId(s?.user.id ?? null);
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load, location.key]);

  const openPicker = useCallback(
    async (state: PickerState) => {
      setPicker(state);
      setPickerLoading(true);
      setPickerMembers([]);
      const sub = items.find((x) => x.id === state.subscriptionId);
      const taken = new Set((sub?.assignedPatientIds ?? []).map(String));
      try {
        const list = await fetchAllPatientMembers();
        setPickerMembers(list.filter((m) => !taken.has(String(m.id))));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load family members");
        setPicker(null);
      } finally {
        setPickerLoading(false);
      }
    },
    [items, toast],
  );

  const closePicker = useCallback(() => {
    setPicker(null);
    setPickerMembers([]);
  }, []);

  const onPickMember = useCallback(
    (m: MemberDisplay) => {
      if (!picker) return;
      const numId =
        m.patientNumericId ?? (Number.parseInt(m.id, 10) > 0 ? Number.parseInt(m.id, 10) : null);
      if (numId == null || numId <= 0) {
        toast.error("This member could not be activated (missing id).");
        return;
      }
      setConfirm({
        memberName: m.name,
        memberNumericId: numId,
        subscriptionId: picker.subscriptionId,
        dependentType: picker.dependentTypeKey,
        slotLabel: picker.typeLabel,
      });
    },
    [picker, toast],
  );

  const runActivate = useCallback(async () => {
    if (!confirm) return;
    setActivating(true);
    try {
      await activateMemberOnPlan({
        memberId: confirm.memberNumericId,
        subscriptionId: confirm.subscriptionId,
        dependentType: confirm.dependentType,
      });
      setConfirm(null);
      closePicker();
      toast.success("Member activated on your plan");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not activate member");
    } finally {
      setActivating(false);
    }
  }, [confirm, closePicker, load, toast]);

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
        <button
          type="button"
          className="profile-sub-page__refresh"
          onClick={() => void load()}
          disabled={loading}
          aria-label={loading ? "Refreshing" : "Refresh subscriptions"}
          title="Refresh"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
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
          <div className="profile-sub-empty-wrap">
            <div className="profile-sub-empty-icon" aria-hidden>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 9a4 4 0 118 0 4 4 0 01-8 0zm16 0v11l-4-2.5V15"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="profile-sub-empty__title">No subscriptions yet</p>
            <p className="profile-sub-empty__text">
              {isSubscribed
                ? "No subscription details were returned."
                : "You do not have an active subscription."}
            </p>
            <p className="profile-sub-empty__hint">
              After you purchase a plan, details will show here.
            </p>
          </div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <ul className="profile-sub-v2-list" aria-label="Active subscriptions">
            {items.map((sub) => (
              <SubscriptionPlanCard
                key={sub.id}
                sub={sub}
                primaryUserId={primaryUserId}
                onOpenSlotPicker={(dependentTypeKey, typeLabel) => {
                  void openPicker({
                    subscriptionId: sub.id,
                    dependentTypeKey,
                    typeLabel,
                  });
                }}
              />
            ))}
          </ul>
        ) : null}
      </main>

      <HomeBottomNav />

      {picker ? (
        <div className="profile-sub-sheet-overlay" role="presentation">
          <button
            type="button"
            className="profile-sub-sheet-overlay__backdrop"
            aria-label="Close"
            onClick={closePicker}
          />
          <div className="profile-sub-sheet" role="dialog" aria-modal="true" aria-labelledby="profile-sub-sheet-title">
            <div className="profile-sub-sheet__grab" aria-hidden />
            <h2 id="profile-sub-sheet-title" className="profile-sub-sheet__title">
              Choose a family member
            </h2>
            <p className="profile-sub-sheet__slot">
              <span className="profile-sub-sheet__slot-badge">{picker.typeLabel}</span>
            </p>
            <p className="profile-sub-sheet__subtitle">
              Only people not already on this plan are listed.
            </p>
            <div className="profile-sub-sheet__list">
              {pickerLoading ? (
                <p className="profile-sub-sheet__loading">Loading family members…</p>
              ) : pickerMembers.length === 0 ? (
                <p className="profile-sub-sheet__empty">
                  Add a family member in your profile first, then return here to assign them.
                </p>
              ) : (
                pickerMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="profile-sub-sheet__member"
                    onClick={() => onPickMember(m)}
                  >
                    <span className="profile-sub-sheet__member-avatar" aria-hidden>
                      {m.name.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                    <span className="profile-sub-sheet__member-text">
                      <span className="profile-sub-sheet__member-name">{m.name}</span>
                      {m.relationship ? (
                        <span className="profile-sub-sheet__member-rel">{m.relationship}</span>
                      ) : null}
                    </span>
                    <span className="profile-sub-sheet__member-chevron" aria-hidden>
                      ›
                    </span>
                  </button>
                ))
              )}
            </div>
            <button type="button" className="profile-sub-sheet__cancel" onClick={closePicker}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {confirm ? (
        <div className="profile-sub-confirm-overlay" role="presentation">
          <div className="profile-sub-confirm" role="alertdialog" aria-labelledby="profile-sub-confirm-title">
            <h2 id="profile-sub-confirm-title" className="profile-sub-confirm__title">
              Activate on plan?
            </h2>
            <p className="profile-sub-confirm__body">
              Assign <strong>{confirm.memberName}</strong> to the <strong>{confirm.slotLabel}</strong> slot?
            </p>
            <div className="profile-sub-confirm__actions">
              <button
                type="button"
                className="profile-sub-confirm__btn profile-sub-confirm__btn--ghost"
                disabled={activating}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="profile-sub-confirm__btn profile-sub-confirm__btn--primary"
                disabled={activating}
                onClick={() => void runActivate()}
              >
                {activating ? "Activating…" : "Activate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SubscriptionPlanCard({
  sub,
  primaryUserId,
  onOpenSlotPicker,
}: Readonly<{
  sub: ActiveSubscriptionItem;
  primaryUserId: number | null;
  onOpenSlotPicker: (dependentTypeKey: string, typeLabel: string) => void;
}>) {
  const planAllows = sub.planAllowsDependentAdd;
  const totalSlots = totalMemberSlots(sub.memberTypeCounts);
  const filledSlots = sub.patients.length;
  const slotAllowed = canUseEmptySlot(sub, primaryUserId);
  const hasStats =
    totalSlots > 0 ||
    typeof sub.daysLeft === "number" ||
    typeof sub.planAmount === "number";

  return (
    <li className="profile-sub-plan-card">
      <div className="profile-sub-plan-card__hero">
        <div className="profile-sub-plan-card__hero-row">
          <h2 className="profile-sub-plan-card__title">{sub.planName}</h2>
          {sub.subscriptionStatusActive ? (
            <span className="profile-sub-plan-card__badge profile-sub-plan-card__badge--active">Active</span>
          ) : null}
        </div>
        {sub.validUntilDisplay ? (
          <p className="profile-sub-plan-card__valid">
            <span className="profile-sub-plan-card__valid-label">Until</span>{" "}
            <span className="profile-sub-plan-card__valid-date">{sub.validUntilDisplay}</span>
          </p>
        ) : null}
      </div>

      <div className="profile-sub-plan-card__body">
        {hasStats ? (
          <div className="profile-sub-plan-card__stats" aria-label="Plan summary">
            {totalSlots > 0 ? (
              <span className="profile-sub-plan-card__stat">
                <span className="profile-sub-plan-card__stat-value">
                  {filledSlots}/{totalSlots}
                </span>
                <span className="profile-sub-plan-card__stat-label">slots</span>
              </span>
            ) : null}
            {typeof sub.daysLeft === "number" ? (
              <span className="profile-sub-plan-card__stat">
                <span className="profile-sub-plan-card__stat-value">{sub.daysLeft}</span>
                <span className="profile-sub-plan-card__stat-label">days left</span>
              </span>
            ) : null}
            {typeof sub.planAmount === "number" ? (
              <span className="profile-sub-plan-card__stat profile-sub-plan-card__stat--price">
                {formatInr(sub.planAmount)}
              </span>
            ) : null}
          </div>
        ) : null}

        {planAllows === false ? (
          <div className="profile-sub-plan-card__warn" role="note">
            <span className="profile-sub-plan-card__warn-icon" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 11V8a5 5 0 0110 0v3M6 11h12v9H6v-9z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>This plan doesn’t allow adding dependents.</span>
          </div>
        ) : null}

        <div className="profile-sub-plan-card__divider" />

        <div className="profile-sub-plan-card__section-head">
          <h3 className="profile-sub-plan-card__section-title">Members</h3>
          {slotAllowed ? (
            <span className="profile-sub-plan-card__section-tag">You can fill open slots</span>
          ) : null}
        </div>

        <SlotList sub={sub} slotAllowed={slotAllowed} onOpenSlotPicker={onOpenSlotPicker} />
      </div>
    </li>
  );
}

function SlotList({
  sub,
  slotAllowed,
  onOpenSlotPicker,
}: Readonly<{
  sub: ActiveSubscriptionItem;
  slotAllowed: boolean;
  onOpenSlotPicker: (dependentTypeKey: string, typeLabel: string) => void;
}>) {
  const counts = sub.memberTypeCounts;
  if (!counts || Object.keys(counts).length === 0) {
    if (sub.patients.length === 0) {
      return <p className="profile-sub-slots__none">—</p>;
    }
    return (
      <ul className="profile-sub-slots">
        {sub.patients.map((p) => (
          <li key={`${sub.id}-${p.id}`}>
            <FilledSlotTile patient={p} typeLabel={friendlySlotType(p.dependentType ?? "")} />
          </li>
        ))}
      </ul>
    );
  }

  const keys = sortSubscriptionMemberTypeKeys(Object.keys(counts));
  const queue = [...sub.patients];
  const rows: ReactNode[] = [];

  for (const typeKey of keys) {
    const slotCount = counts[typeKey] ?? 0;
    if (slotCount <= 0) continue;

    const filledHere = countPatientsForType(sub.patients, typeKey);
    const typeLabel = friendlySlotType(typeKey);

    rows.push(
      <div key={`h-${typeKey}`} className="profile-sub-slot-type-row">
        <span className="profile-sub-slot-type-row__label">{typeLabel}</span>
        <span className="profile-sub-slot-type-row__count">
          {filledHere} / {slotCount}
        </span>
      </div>,
    );

    for (let i = 0; i < slotCount; i++) {
      const idx = queue.findIndex((u) => u.dependentType?.toString() === typeKey);
      if (idx >= 0) {
        const u = queue.splice(idx, 1)[0];
        rows.push(
          <div key={`${typeKey}-f-${i}-${u.id}`} className="profile-sub-slot-item">
            <FilledSlotTile patient={u} typeLabel={typeLabel} />
          </div>,
        );
      } else {
        rows.push(
          <div key={`${typeKey}-e-${i}`} className="profile-sub-slot-item">
            <EmptySlotTile
              canTap={slotAllowed}
              typeLabel={typeLabel}
              onActivate={() => onOpenSlotPicker(typeKey, typeLabel)}
            />
          </div>,
        );
      }
    }
  }

  return <div className="profile-sub-slots">{rows}</div>;
}

function FilledSlotTile({
  patient,
  typeLabel,
}: Readonly<{ patient: ActiveSubscriptionPatientRow; typeLabel: string }>) {
  return (
    <div className="profile-sub-filled-slot">
      <div className="profile-sub-filled-slot__check" aria-hidden>
        ✓
      </div>
      <div className="profile-sub-filled-slot__text">
        <p className="profile-sub-filled-slot__name">{patient.name}</p>
        <p className="profile-sub-filled-slot__meta">{typeLabel}</p>
      </div>
    </div>
  );
}

function EmptySlotTile({
  canTap,
  typeLabel,
  onActivate,
}: Readonly<{
  canTap: boolean;
  typeLabel: string;
  onActivate: () => void;
}>) {
  return (
    <button
      type="button"
      className={`profile-sub-empty-slot${canTap ? " profile-sub-empty-slot--active" : ""}`}
      disabled={!canTap}
      onClick={canTap ? onActivate : undefined}
    >
      <span className="profile-sub-empty-slot__icon" aria-hidden>
        +
      </span>
      <span className="profile-sub-empty-slot__main">
        <span className="profile-sub-empty-slot__title">Add · {typeLabel}</span>
        <span className="profile-sub-empty-slot__hint">
          {canTap
            ? "Tap to choose someone from your family list."
            : "Only the plan purchaser can assign members here."}
        </span>
      </span>
    </button>
  );
}
