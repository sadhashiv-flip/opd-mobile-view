import { ROUTES } from "@/constants";
import { clearVaccinationFlowState, writeVaccinationFlowState } from "@/constants/vaccinationFlowStorage";
import { ensureDefaultSelectedAddressIfNeeded } from "@/api/patientAddress";
import { fetchAllPatientMembers } from "@/api/patientMember";
import { fetchAnySubscriptionCanActivate } from "@/api/patientSubscriptions";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { AddressStripLabels } from "@/components/address/AddressStripLabels";
import { SelectPeopleMemberList } from "@/components/select-people/SelectPeopleMemberList";
import { patientMembersToGymRows, type GymMemberListRow } from "@/lib/gymMemberDisplay";
import { defaultSingleSelectHint, SELECT_PEOPLE_COPY } from "@/lib/selectPeopleShared";
import { toggleSelectPeopleMember } from "@/hooks/useSelectPeopleMemberSelection";
import { useProfileModuleGates } from "@/hooks/useProfileModuleGates";
import { useSelectedAddressLine } from "@/hooks/useSelectedAddressLine";
import { useToast } from "@/hooks/useToast";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./HealthCheckupsPage.css";
import "./HealthCheckupsOverviewPage.css";

export function VaccinationSelectPeoplePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const mod = useProfileModuleGates();
  const canAddFamily = mod.planDependents.dependentAddAllowed;
  const [rows, setRows] = useState<GymMemberListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const hcLocAddrRaw = useSelectedAddressLine("");
  const returnPath = `${location.pathname}${location.search}`;

  const memberListConfig = useMemo(
    () => ({
      showAhcSponsorSubtitle: false,
      restrictToAhcSelection: false,
      isDiagnosticsFlow: false,
    }),
    [],
  );

  useEffect(() => {
    clearVaccinationFlowState();
  }, []);

  useEffect(() => {
    void ensureDefaultSelectedAddressIfNeeded();
  }, []);

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
        if (!cancelled) setRows(patientMembersToGymRows(list, { subscriptionCanActivate: canAct }));
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          const msg = e instanceof Error ? e.message : "Could not load members";
          setFetchError(msg);
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast, location.key]);

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds((prev) =>
      prev.filter((id) => {
        const r = rows.find((x) => x.id === id);
        return Boolean(r?.isSubscribed);
      }),
    );
  }, [rows]);

  const hasAddress = hcLocAddrRaw.trim() !== "";
  const canContinue =
    selectedIds.length > 0 && !loading && !fetchError && rows.length > 0 && hasAddress;

  const toggleMember = (memberId: string) => {
    setSelectedIds(toggleSelectPeopleMember(memberId, rows, { allowDeselect: true }));
  };

  const goProfileSubscriptions = () => {
    void navigate(ROUTES.profileSubscriptions, {
      state: { returnPath },
    });
  };

  const continueButtonLabel = (() => {
    if (!hasAddress) {
      return selectedIds.length === 0
        ? SELECT_PEOPLE_COPY.addAddressAndSelectMembers
        : SELECT_PEOPLE_COPY.addAddressToContinue;
    }
    if (selectedIds.length === 0) return SELECT_PEOPLE_COPY.selectMemberToContinue;
    return "Continue";
  })();

  const onContinue = () => {
    if (selectedIds.length === 0 || !hasAddress) return;
    const id = selectedIds[0];
    if (!id) return;
    const row = rows.find((r) => r.id === id) ?? null;
    if (!row) return;
    if (row.userId == null) {
      toast.error("Could not resolve this member’s user id. Try again or update the profile.");
      return;
    }
    writeVaccinationFlowState({
      memberId: id,
      memberName: row.name,
      userId: row.userId,
      selectedServices: [],
      preferredDateTime: "",
    });
    void navigate(ROUTES.vaccinationChooseType);
  };

  return (
    <div className="hc-page">
      <header className="hco-top">
        <Link to={ROUTES.services} className="hco-back" aria-label="Back to services">
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
        <h1 className="hco-title">Vaccination</h1>
        <span className="hco-top__spacer" aria-hidden />
      </header>

      <main className="hc-main">
        <div className="hc-loc-wrap">
          <button
            type="button"
            className="hc-select-loc"
            aria-label={hcLocAddrRaw.trim() ? "Choose address" : "Add delivery address"}
            onClick={() => setAddrSheetOpen(true)}
          >
            <span className="hc-select-loc__pin" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 22s7-5.1 7-12a7 7 0 10-14 0c0 6.9 7 12 7 12z" fill="#FF541E" />
                <circle cx="12" cy="10" r="2.5" fill="#ffffff" opacity="0.95" />
              </svg>
            </span>
            <AddressStripLabels
              layout="pipe"
              addrRaw={hcLocAddrRaw}
              titleClassName="hc-select-loc__title"
              sepClassName="hc-select-loc__sep"
              addrClassName="hc-select-loc__addr"
              promptClassName="hc-select-loc__addr hc-select-loc__addr--prompt"
            />
            <span className="hc-select-loc__chev" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>

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
          <SelectPeopleMemberList
            members={rows}
            selectedIds={selectedIds}
            onToggle={toggleMember}
            onNavigateSubscriptions={goProfileSubscriptions}
            config={memberListConfig}
            selectionHint={defaultSingleSelectHint()}
            canAddFamily={canAddFamily}
            returnPath={returnPath}
          />
        ) : null}
      </main>

      <footer className="hc-footer">
        <button type="button" className="bottom-continue" disabled={!canContinue} onClick={onContinue}>
          {continueButtonLabel}
        </button>
      </footer>

      <AddressBottomSheet open={addrSheetOpen} onClose={() => setAddrSheetOpen(false)} />
    </div>
  );
}
