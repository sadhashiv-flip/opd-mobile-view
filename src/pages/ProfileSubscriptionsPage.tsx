import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { FamilyMemberAvatar } from "@/components/family/FamilyMemberAvatar";
import { MaterialIcon } from "@/components/icons/MaterialIcon";
import {
  activateMemberOnPlan,
  fetchActiveSubscriptions,
  sortSubscriptionMemberTypeKeys,
  type ActiveSubscriptionItem,
  type ActiveSubscriptionPatientRow,
} from "@/api/patientSubscriptions";
import { fetchAllPatientMembers, type MemberDisplay } from "@/api/patientMember";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import {
  canActivateOnSubscription,
  readPrimaryUserIdFromCache,
  totalMemberSlots,
} from "@/lib/subscriptionPageUtils";
import "./ProfileManagePage.css";
import "./ProfileSubscriptionsPage.css";

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
      return rawKey.charAt(0).toUpperCase() + rawKey.slice(1).toLowerCase();
  }
}

function countPatientsForType(
  patients: readonly ActiveSubscriptionPatientRow[],
  typeKey: string,
): number {
  return patients.filter((p) => p.dependentType?.toString() === typeKey).length;
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

type ActivationGuideState = Readonly<{
  showActivationGuide?: boolean;
  memberName?: string;
}>;

export function ProfileSubscriptionsPage() {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const primaryUserId = useMemo(() => readPrimaryUserIdFromCache(), [location.key]);

  const handleBack = useCallback(() => {
    if (location.state?.returnPath) {
      navigate(location.state.returnPath);
    } else {
      navigate(ROUTES.profile);
    }
  }, [location.state, navigate]);

  const [items, setItems] = useState<readonly ActiveSubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [picker, setPicker] = useState<PickerState | null>(null);
  const [pickerMembers, setPickerMembers] = useState<readonly MemberDisplay[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [activating, setActivating] = useState(false);
  const [activationGuide, setActivationGuide] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchActiveSubscriptions();
      setItems(res.items);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "Could not load subscriptions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, location.key]);

  useEffect(() => {
    const state = location.state as ActivationGuideState | null | undefined;
    if (!state?.showActivationGuide) return;
    const name = state.memberName?.trim() ?? "";
    setActivationGuide(
      name.length
        ? `${name} was added successfully. To activate, open any subscription card, tap an empty slot, and choose this member.`
        : "Member was added successfully. To activate, open any subscription card, tap an empty slot, and choose the member.",
    );
  }, [location.key, location.state]);

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
    <div className="profile-manage-page profile-sub-page">
      <header className="profile-manage-page__top">
        <button
          type="button"
          onClick={handleBack}
          className="app-back-btn profile-manage-page__back"
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
        <h1 className="profile-manage-page__title">My subscriptions</h1>
        <span className="profile-manage-page__spacer" aria-hidden />
      </header>

      <main className="profile-manage-page__main profile-sub-page__main">
        {loading ? (
          <div className="profile-sub-loading" aria-busy="true">
            <div className="profile-sub-loading__spinner" aria-hidden />
            <p className="profile-sub-loading__text">Loading your subscription…</p>
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

        {!loading && !error && items.length === 0 ? (
          <div className="profile-sub-empty-wrap">
            <MaterialIcon
              name="card_membership"
              rounded
              size={72}
              className="profile-sub-empty-icon"
            />
            <p className="profile-sub-empty__title">No active subscription</p>
            <p className="profile-sub-empty__text">
              You do not have an active subscription yet. Purchase a plan to assign family members
              to slots.
            </p>
            <p className="profile-sub-empty__hint">Pull down to refresh</p>
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
          <div
            className="profile-sub-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-sub-sheet-title"
          >
            <div className="profile-sub-sheet__grab" aria-hidden />
            <h2 id="profile-sub-sheet-title" className="profile-sub-sheet__title">
              Who should use this slot?
            </h2>
            <p className="profile-sub-sheet__slot">
              <span className="profile-sub-sheet__slot-badge">{picker.typeLabel}</span>
              <span className="profile-sub-sheet__slot-key">{picker.dependentTypeKey}</span>
            </p>
            <p className="profile-sub-sheet__subtitle">
              We will link them to this plan for benefits.
            </p>
            <div className="profile-sub-sheet__list">
              {pickerLoading ? (
                <p className="profile-sub-sheet__loading">Loading family members…</p>
              ) : pickerMembers.length === 0 ? (
                <p className="profile-sub-sheet__empty">
                  Add a family member in your profile first, then assign them here.
                </p>
              ) : (
                pickerMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="profile-sub-sheet__member"
                    onClick={() => onPickMember(m)}
                  >
                    <FamilyMemberAvatar name={m.name} image={m.image} variant="list" />
                    <span className="profile-sub-sheet__member-text">
                      <span className="profile-sub-sheet__member-name">{m.name}</span>
                      {m.relationship ? (
                        <span className="profile-sub-sheet__member-rel">{m.relationship}</span>
                      ) : null}
                    </span>
                    <MaterialIcon
                      name="chevron_right"
                      rounded
                      size={22}
                      className="profile-sub-sheet__member-chevron"
                    />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {confirm ? (
        <div className="profile-sub-confirm-overlay" role="presentation">
          <div className="profile-sub-confirm" role="alertdialog" aria-labelledby="profile-sub-confirm-title">
            <h2 id="profile-sub-confirm-title" className="profile-sub-confirm__title">
              Activate on this plan?
            </h2>
            <p className="profile-sub-confirm__body">
              You chose <strong>{confirm.memberName}</strong> for the{" "}
              <strong>{confirm.slotLabel}</strong> slot. They will be linked to this subscription
              for plan benefits. Do you want to continue?
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

      {activationGuide ? (
        <div className="profile-sub-confirm-overlay" role="presentation">
          <div className="profile-sub-confirm" role="dialog" aria-labelledby="profile-sub-guide-title">
            <h2 id="profile-sub-guide-title" className="profile-sub-confirm__title">
              Next step: Activate member
            </h2>
            <p className="profile-sub-confirm__body">{activationGuide}</p>
            <div className="profile-sub-confirm__actions profile-sub-confirm__actions--single">
              <button
                type="button"
                className="profile-sub-confirm__btn profile-sub-confirm__btn--primary"
                onClick={() => setActivationGuide(null)}
              >
                OK
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
  const totalSlots = totalMemberSlots(sub.memberTypeCounts);
  const filledSlots = sub.patients.length;
  const progressLabel =
    totalSlots > 0 ? `${filledSlots} / ${totalSlots} slots` : "";
  const { canTap: slotAllowed, disabledHint: emptySlotDisabledHint } = canActivateOnSubscription(
    sub,
    primaryUserId,
  );

  return (
    <li className="profile-sub-plan-card">
      <div className="profile-sub-plan-card__hero">
        <div className="profile-sub-plan-card__hero-row">
          <h2 className="profile-sub-plan-card__title">{sub.planName}</h2>
          {sub.subscriptionStatusActive ? (
            <span className="profile-sub-plan-card__badge profile-sub-plan-card__badge--active">
              Active
            </span>
          ) : null}
        </div>
        {sub.validUntilDisplay ? (
          <p className="profile-sub-plan-card__valid">
            <MaterialIcon name="event" rounded size={15} className="profile-sub-plan-card__valid-icon" />
            <span className="profile-sub-plan-card__valid-label">Valid until</span>
            <span className="profile-sub-plan-card__valid-date">{sub.validUntilDisplay}</span>
          </p>
        ) : null}
      </div>

      <div className="profile-sub-plan-card__body">
        {progressLabel ? (
          <p className="profile-sub-plan-card__progress">
            <MaterialIcon
              name="people_outline"
              rounded
              size={16}
              className="profile-sub-plan-card__progress-icon"
            />
            <span>{progressLabel}</span>
          </p>
        ) : null}

        {!sub.planAllowsDependentAdd ? (
          <div className="profile-sub-plan-card__warn" role="note">
            <MaterialIcon
              name="lock_outline"
              rounded
              size={18}
              className="profile-sub-plan-card__warn-icon"
            />
            <span>
              Your current plan does not allow adding family members. You can review options under
              Subscriptions.
            </span>
          </div>
        ) : null}

        <div className="profile-sub-plan-card__divider" />

        <h3 className="profile-sub-plan-card__section-title">Who is covered</h3>
        <p className="profile-sub-plan-card__section-subtitle">
          Filled slots show who is already on this plan. Tap an empty slot to assign someone.
        </p>

        <SlotList
          sub={sub}
          emptySlotCanTap={slotAllowed}
          emptySlotDisabledHint={emptySlotDisabledHint}
          onOpenSlotPicker={onOpenSlotPicker}
        />
      </div>
    </li>
  );
}

function SlotList({
  sub,
  emptySlotCanTap,
  emptySlotDisabledHint,
  onOpenSlotPicker,
}: Readonly<{
  sub: ActiveSubscriptionItem;
  emptySlotCanTap: boolean;
  emptySlotDisabledHint: string;
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
              canTap={emptySlotCanTap}
              disabledHint={emptySlotDisabledHint}
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
        <MaterialIcon name="check" rounded size={20} />
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
  disabledHint,
  typeLabel,
  onActivate,
}: Readonly<{
  canTap: boolean;
  disabledHint: string;
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
      <MaterialIcon
        name="person_add_alt_1"
        rounded
        size={20}
        className="profile-sub-empty-slot__icon"
      />
      <span className="profile-sub-empty-slot__main">
        <span className="profile-sub-empty-slot__title">
          Assign family member · {typeLabel}
        </span>
        <span className="profile-sub-empty-slot__hint">
          {canTap ? "Tap to choose from your saved family members" : disabledHint}
        </span>
      </span>
    </button>
  );
}
