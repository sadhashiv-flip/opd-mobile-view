import { ROUTES } from "@/constants";
import {
  clearVaccinationAfterChooseType,
  readVaccinationFlowState,
  writeVaccinationFlowState,
} from "@/constants/vaccinationFlowStorage";
import { fetchAllVaccineServices, type VaccineServiceItem } from "@/api/vaccineService";
import { VaccinationAddressBar } from "@/components/vaccination/VaccinationAddressBar";
import { VaccinationServiceIcon } from "@/components/vaccination/VaccinationServiceIcon";
import { useToast } from "@/hooks/useToast";
import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import "./HealthCheckupsPage.css";
import "./HealthCheckupsOverviewPage.css";
import "./VaccinationChooseTypePage.css";

export function VaccinationChooseTypePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const flow = readVaccinationFlowState();
  const [items, setItems] = useState<VaccineServiceItem[]>([]);
  const [load, setLoad] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    const s = readVaccinationFlowState();
    if (!s?.memberId) {
      void navigate(ROUTES.vaccinationSelectPeople, { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (items.length === 0) return;
    const s = readVaccinationFlowState();
    if (s?.selectedServices?.length) {
      setSelected(new Set(s.selectedServices.map((x) => x.id)));
    }
  }, [items.length, location.key]);

  const loadList = useCallback(async () => {
    setLoad("loading");
    try {
      const list = await fetchAllVaccineServices();
      setItems(list);
      setLoad("ok");
    } catch (e) {
      setLoad("error");
      toast.error(e instanceof Error ? e.message : "Could not load vaccines");
    }
  }, [toast]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onContinue = () => {
    if (!flow?.memberId || selected.size === 0) return;
    const picked: { id: number; name: string }[] = [];
    for (const id of selected) {
      const row = items.find((i) => i.id === id);
      if (row) picked.push({ id: row.id, name: row.name });
    }
    if (picked.length === 0) return;
    writeVaccinationFlowState({
      memberId: flow.memberId,
      memberName: flow.memberName,
      userId: flow.userId,
      selectedServices: picked,
      preferredDateTime: flow.preferredDateTime ?? "",
    });
    void navigate(ROUTES.vaccinationSlots);
  };

  const n = selected.size;
  const canContinue = n > 0 && load === "ok";

  return (
    <div className="hc-page vac-choose">
      <header className="hco-top">
        <FlowScreenBack
          fallbackTo={ROUTES.vaccinationSelectPeople}
          className="hco-back"
          onBeforeBack={clearVaccinationAfterChooseType}
        />
        <h1 className="hco-title">Choose Vaccine Type</h1>
        <span className="hco-top__balance" aria-hidden />
      </header>

      <main className="hc-main vac-choose__main">
        <VaccinationAddressBar />

        {load === "loading" ? (
          <p className="vac-choose__msg" aria-busy="true">
            Loading vaccines…
          </p>
        ) : null}
        {load === "error" ? (
          <div className="vac-choose__err">
            <p>Could not load vaccines.</p>
            <button type="button" className="bottom-continue" onClick={() => void loadList()}>
              Retry
            </button>
          </div>
        ) : null}

        {load === "ok" ? (
          <ul className="vac-choose__list">
            {items.map((v) => {
              const on = selected.has(v.id);
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    className={`vac-choose__card${on ? " vac-choose__card--on" : ""}`}
                    onClick={() => toggle(v.id)}
                  >
                    <span className="vac-choose__ic-wrap" aria-hidden>
                      <VaccinationServiceIcon accent={on} />
                    </span>
                    <span className="vac-choose__text">
                      <span className="vac-choose__name">{v.name}</span>
                      <span className="vac-choose__sub">{v.serviceType ?? "vaccine"}</span>
                    </span>
                    <span className="vac-choose__check" aria-hidden>
                      <span className={on ? "vac-choose__box vac-choose__box--on" : "vac-choose__box"}>
                        {on ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M5 12.5l4.5 4.5L19 7"
                              stroke="#fff"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </main>

      <footer className="hc-footer vac-choose__footer">
        {n > 0 ? (
          <p className="vac-choose__selection" role="status">
            <span className="vac-choose__sel-ic" aria-hidden>
              ✓
            </span>
            Selected Vaccines: {n}
          </p>
        ) : (
          <span className="vac-choose__selection vac-choose__selection--muted">Select at least one vaccine</span>
        )}
        <button type="button" className="bottom-continue" disabled={!canContinue} onClick={onContinue}>
          Continue
        </button>
      </footer>
    </div>
  );
}
