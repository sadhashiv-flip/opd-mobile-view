import { ROUTES } from "@/constants";
import { readGymCheckSnapshot } from "@/constants/gymCheckStorage";
import {
  buildGymMemberSnapshotFromRow,
  readGymSelectedPersonIds,
  writeGymSelectedMembersSnapshots,
  writeGymSelectedPersonIds,
} from "@/constants/gymSelectedMemberStorage";
import { fetchAllPatientMembers } from "@/api/patientMember";
import { fetchAnySubscriptionCanActivate } from "@/api/patientSubscriptions";
import profileSvg from "@/assets/icons/Dashboard/Profile.svg";
import { SelectPeopleAddedCta } from "@/components/select-people/SelectPeopleAddedCta";
import { SubscriptionActivateCtaButton } from "@/components/select-people/SubscriptionActivateCtaButton";
import {
  defaultGymMemberSelection,
  HC_PERSON_ADD_CTA_TOOLTIP,
  HC_PERSON_ADD_GYM_MAX_TOOLTIP,
  memberShowsSubscriptionActivateCta,
  patientMembersToGymRows,
  type GymMemberListRow,
} from "@/lib/gymMemberDisplay";
import { selectPeopleMemberLine } from "@/lib/selectPeopleShared";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import { useToast } from "@/hooks/useToast";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./HealthCheckupsPage.css";
import "./HealthCheckupsOverviewPage.css";

function readStoredGymPlanId(): string | null {
  try {
    const p = localStorage.getItem("opd-mobile-view.gym-membership.planId");
    return p && p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

export function GymMembershipSelectPeoplePage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(ROUTES.gymMembership, { replace: true });
  }, [navigate]);

  const location = useLocation();
  const toast = useToast();
  const mod = useProfileModuleGates();
  const canAddFamily = mod.planDependents.dependentAddAllowed;
  const statePlanId =
    typeof (location.state as { planId?: unknown } | null)?.planId === "string"
      ? (location.state as { planId: string }).planId
      : null;
  const planId = statePlanId ?? readStoredGymPlanId();

  const pageTitle = "Gym Membership";

  const [rows, setRows] = useState<GymMemberListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    void (async () => {
      try {
        const [list, canAct] = await Promise.all([
          fetchAllPatientMembers(),
          fetchAnySubscriptionCanActivate(),
        ]);
        if (!cancelled) {
          setRows(patientMembersToGymRows(list, { subscriptionCanActivate: canAct }));
        }
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          const msg = e instanceof Error ? e.message : "Could not load members";
          setFetchError(msg);
          toast.error(msg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast, location.key]);

  /** Up to 2 enrollees when multiple members exist; configure/overview enforce plan rules. */
  const maxSelectable = useMemo(() => (rows.length >= 2 ? 2 : 1), [rows.length]);

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds((prev) => {
      let next = prev.filter((id) => {
        const r = rows.find((x) => x.id === id);
        return Boolean(r?.isSubscribed);
      });
      if (next.length === 0) {
        const stored = readGymSelectedPersonIds().filter((id) => {
          const r = rows.find((x) => x.id === id);
          return Boolean(r?.isSubscribed);
        });
        next = stored.length > 0 ? stored : defaultGymMemberSelection(rows);
      }
      if (next.length > maxSelectable) {
        next = next.slice(0, maxSelectable);
      }
      return next;
    });
  }, [rows, maxSelectable]);

  useEffect(() => {
    if (!planId) {
      navigate(ROUTES.gymMembership, { replace: true });
    }
  }, [planId, navigate]);

  const selfMembers = useMemo(
    () => rows.filter((m) => m.section === "self"),
    [rows],
  );

  const familyMembersList = useMemo(
    () => rows.filter((m) => m.section === "family"),
    [rows],
  );

  const toggleMember = (memberId: string) => {
    const row = rows.find((r) => r.id === memberId);
    if (!row?.isSubscribed) return;
    setSelectedIds((prev) => {
      if (prev.includes(memberId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== memberId);
      }
      if (prev.length >= maxSelectable) {
        toast.error(
          maxSelectable === 1
            ? "Only one member is available to select."
            : "You can select up to 2 members.",
        );
        return prev;
      }
      return [...prev, memberId];
    });
  };

  const goProfileSubscriptions = () => {
    void navigate(ROUTES.profileSubscriptions, {
      state: { returnPath: `${location.pathname}${location.search}` },
    });
  };

  function MultiSelectCheckbox({ memberId }: Readonly<{ memberId: string }>) {
    const on = selectedIds.includes(memberId);
    return (
      <span className="hc-person__multi-wrap" aria-hidden="true">
        <span className={on ? "hc-person__multi-box hc-person__multi-box--on" : "hc-person__multi-box"}>
          {on ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 12.5l4.5 4.5L19 7"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </span>
      </span>
    );
  }

  const renderTrailing = (member: GymMemberListRow) => {
    if (member.isChildBlocked) {
      return null;
    }
    const isSelected = selectedIds.includes(member.id);
    if (isSelected) {
      return <SelectPeopleAddedCta />;
    }
    if (memberShowsSubscriptionActivateCta(member)) {
      return <SubscriptionActivateCtaButton onClick={goProfileSubscriptions} />;
    }
    if (!member.isSubscribed) {
      return null;
    }
    const atMax = selectedIds.length >= maxSelectable;
    return (
      <span
        className={`hc-person__cta${atMax ? " hc-person__cta--disabled" : ""}`}
        aria-hidden="true"
        title={atMax ? HC_PERSON_ADD_GYM_MAX_TOOLTIP : HC_PERSON_ADD_CTA_TOOLTIP}
      >
        Add
      </span>
    );
  };

  if (!planId) {
    return null;
  }

  const canContinue =
    selectedIds.length > 0 && !loading && !fetchError && rows.length > 0;

  return (
    <div className="hc-page">
      <header className="hco-top">
        <Link to={ROUTES.gymMembership} className="hco-back" aria-label="Back to gym plans">
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
        <h1 className="hco-title">{pageTitle}</h1>
        <span className="hco-top__spacer" aria-hidden />
      </header>

      <main className="hc-main">
        {loading ? (
          <p className="hc-member-loading" aria-busy="true">
            Loading members…
          </p>
        ) : null}

        {!loading && fetchError ? (
          <div className="hc-member-error">
            <p className="hc-member-error__text">{fetchError}</p>
            <button
              type="button"
              className="bottom-continue"
              onClick={() => {
                setFetchError(null);
                setLoading(true);
                void (async () => {
                  try {
                    const [list, canAct] = await Promise.all([
                      fetchAllPatientMembers(),
                      fetchAnySubscriptionCanActivate(),
                    ]);
                    setRows(patientMembersToGymRows(list, { subscriptionCanActivate: canAct }));
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : "Could not load members";
                    setFetchError(msg);
                    toast.error(msg);
                  } finally {
                    setLoading(false);
                  }
                })();
              }}
            >
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !fetchError && rows.length === 0 ? (
          <p className="hc-member-empty">No members on your account. Add a family member to continue.</p>
        ) : null}

        {!loading && !fetchError && rows.length > 0 ? (
          <>
            <section className="hc-block">
              <h2 className="hc-block__title">For you</h2>
              <p className="hc-block__hint">
                <span className="hc-check" aria-hidden="true">
                  ✓
                </span>
                Book free gym membership
              </p>
              {maxSelectable > 1 ? (
                <p className="hc-block__subhint">
                  Multi-select: choose up to 2 members (tap a row or use Add). Order is kept for enrolment.
                </p>
              ) : (
                <p className="hc-block__subhint">Select a member to continue.</p>
              )}

              {selfMembers.length === 0 ? (
                <p className="hc-block__empty-hint">No primary profile listed. Add or update members in Profile.</p>
              ) : null}

              {selfMembers.map((member) => {
                const canSubActivate = memberShowsSubscriptionActivateCta(member);
                const notActivated = !member.isSubscribed;
                const rowDisabled = notActivated;
                const { text: subtitle, subClass } = selectPeopleMemberLine(member, {
                  relaxMemberRestrictions: false,
                });
                const rowClass = `hc-person${selectedIds.includes(member.id) ? " hc-person--selected" : ""}${rowDisabled && !canSubActivate ? " hc-person--disabled" : ""}${canSubActivate ? " hc-person--subscription-activate" : ""}${member.isChildBlocked ? " hc-person--age-blocked" : ""}`;
                const body = (
                  <>
                    {!member.isChildBlocked ? <MultiSelectCheckbox memberId={member.id} /> : null}
                    <span className="hc-person__avatar" aria-hidden="true">
                      <img src={profileSvg} alt="" width={22} height={22} draggable={false} />
                    </span>
                    <span className="hc-person__info">
                      <span className="hc-person__name">{member.name}</span>
                      {subtitle ? (
                        <span className={`hc-person__sub${subClass}`}>{subtitle}</span>
                      ) : null}
                    </span>
                    {renderTrailing(member)}
                  </>
                );
                if (canSubActivate) {
                  return (
                    <div key={member.id} className={rowClass}>
                      {body}
                    </div>
                  );
                }
                return (
                  <button
                    key={member.id}
                    type="button"
                    disabled={rowDisabled}
                    className={rowClass}
                    aria-pressed={selectedIds.includes(member.id)}
                    onClick={() => toggleMember(member.id)}
                  >
                    {body}
                  </button>
                );
              })}
            </section>

            <section className="hc-block">
              <h2 className="hc-block__title">For your family</h2>
              <p className="hc-block__hint">
                <span className="hc-check" aria-hidden="true">
                  ✓
                </span>
                Book gym membership for family members
              </p>
              {maxSelectable > 1 ? (
                <p className="hc-block__subhint">Family members can be included in your multi-select.</p>
              ) : null}

              {familyMembersList.map((member) => {
                const canSubActivate = memberShowsSubscriptionActivateCta(member);
                const notActivated = !member.isSubscribed;
                const rowDisabled = notActivated;
                const { text: subtitle, subClass } = selectPeopleMemberLine(member, {
                  relaxMemberRestrictions: false,
                });
                const rowClass = `hc-person${selectedIds.includes(member.id) ? " hc-person--selected" : ""}${rowDisabled && !canSubActivate ? " hc-person--disabled" : ""}${canSubActivate ? " hc-person--subscription-activate" : ""}${member.isChildBlocked ? " hc-person--age-blocked" : ""}`;
                const body = (
                  <>
                    {!member.isChildBlocked ? <MultiSelectCheckbox memberId={member.id} /> : null}
                    <span className="hc-person__avatar" aria-hidden="true">
                      <img src={profileSvg} alt="" width={22} height={22} draggable={false} />
                    </span>
                    <span className="hc-person__info">
                      <span className="hc-person__name">{member.name}</span>
                      {subtitle ? (
                        <span className={`hc-person__sub${subClass}`}>{subtitle}</span>
                      ) : null}
                    </span>
                    {renderTrailing(member)}
                  </>
                );
                if (canSubActivate) {
                  return (
                    <div key={member.id} className={rowClass}>
                      {body}
                    </div>
                  );
                }
                return (
                  <button
                    key={member.id}
                    type="button"
                    disabled={rowDisabled}
                    className={rowClass}
                    aria-pressed={selectedIds.includes(member.id)}
                    onClick={() => toggleMember(member.id)}
                  >
                    {body}
                  </button>
                );
              })}

              {canAddFamily ? (
                <button
                  type="button"
                  className="hc-add-family"
                  onClick={() =>
                    navigate(ROUTES.profileMembersAdd, {
                      state: {
                        title: pageTitle,
                        returnPath: ROUTES.gymMembershipSelectPeople,
                        returnState: { planId },
                      },
                    })
                  }
                >
                  <span className="hc-add-family__ic" aria-hidden="true">
                    +
                  </span>
                  Add new family member
                </button>
              ) : null}
            </section>
          </>
        ) : null}
      </main>

      <footer className="hc-footer">
        {rows.length > 0 && !loading && !fetchError ? (
          <p className="hc-footer-selection" role="status">
            {maxSelectable > 1 ? (
              <>
                <strong>{selectedIds.length}</strong> of {maxSelectable} selected
              </>
            ) : (
              <>
                <strong>{selectedIds.length}</strong> selected
              </>
            )}
          </p>
        ) : null}
        <button
          type="button"
          className="bottom-continue"
          disabled={!canContinue}
          onClick={() => {
            if (selectedIds.length === 0) return;
            const check = readGymCheckSnapshot();
            const orderedRows = selectedIds
              .map((id) => rows.find((r) => r.id === id))
              .filter((r): r is GymMemberListRow => Boolean(r));
            if (orderedRows.length === 0) return;
            const snapshots = orderedRows.map((row) =>
              buildGymMemberSnapshotFromRow(row, check),
            );
            writeGymSelectedMembersSnapshots(snapshots);
            writeGymSelectedPersonIds(selectedIds);
            navigate(ROUTES.gymMembershipConfigure, {
              state: planId ? { planId } : undefined,
            });
          }}
        >
          Continue
        </button>
      </footer>
    </div>
  );
}
