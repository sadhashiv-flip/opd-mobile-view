import { PHARMACY_IMAGES } from "@/assets/images/pharmacy";
import { ensureDefaultSelectedAddressIfNeeded } from "@/api/patientAddress";
import { postMedicineOrder } from "@/api/pharmacy";
import {
  findMockPrescription,
  type PharmacyMedicineSchedule,
  type PharmacyMockPrescription,
} from "@/constants/pharmacyMockData";
import { readCachedPharmacyPrescription } from "@/constants/pharmacyPrescriptionsCache";
import { readPharmacyFlowState, resolvePharmacyOrderAddressId } from "@/constants/pharmacyFlowStorage";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./PharmacyPages.css";

type NavState = Readonly<{ returnPath?: string; prescription?: PharmacyMockPrescription }>;

type SlotKey = "morning" | "afternoon" | "night";

function dash(s: string | undefined): string {
  const t = s?.trim();
  return t ? t : "—";
}

function isNoneSlotStr(v: string): boolean {
  return /^none$/i.test(v.trim());
}

function slotsFromSchedule(
  sched?: PharmacyMedicineSchedule,
): readonly { key: SlotKey; title: string; sub: string }[] {
  if (!sched) return [];
  const pairs: { key: SlotKey; title: string; val?: string }[] = [
    { key: "morning", title: "Morning", val: sched.morning },
    { key: "afternoon", title: "Afternoon", val: sched.afternoon },
    { key: "night", title: "Night", val: sched.night },
  ];
  const out: { key: SlotKey; title: string; sub: string }[] = [];
  for (const p of pairs) {
    const v = p.val?.trim();
    if (v && !isNoneSlotStr(v)) {
      out.push({ key: p.key, title: p.title, sub: v });
    }
  }
  return out;
}

function weeklyChipText(sched?: PharmacyMedicineSchedule): string | null {
  const w = sched?.weekly?.trim();
  if (!w || w === "0") return null;
  return `${w} times/week`;
}

function slotEmoji(key: SlotKey): string {
  if (key === "morning") return "☀";
  if (key === "afternoon") return "☁";
  return "🌙";
}

function slotClassSuffix(key: SlotKey): "m" | "a" | "n" {
  if (key === "morning") return "m";
  if (key === "afternoon") return "a";
  return "n";
}

function slotRowMod(count: number): string {
  if (count >= 3) return "3";
  if (count === 2) return "2";
  if (count === 1) return "1";
  return "0";
}

export function PharmacyPrescriptionDetailPage() {
  const { prescriptionId: prescriptionIdParam } = useParams<{ prescriptionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const hubReturn = (location.state as NavState | null)?.returnPath ?? ROUTES.dashboard;
  const passState: NavState = { returnPath: hubReturn };

  const prescriptionId = prescriptionIdParam?.trim() ?? "";
  const flow = readPharmacyFlowState();
  const rx = useMemo((): PharmacyMockPrescription | null => {
    const st = location.state as NavState | null;
    const fromNav = st?.prescription;
    if (fromNav && fromNav.prescriptionId === prescriptionId) {
      return fromNav;
    }
    if (flow && prescriptionId) {
      return readCachedPharmacyPrescription(flow.patientId, prescriptionId) ?? findMockPrescription(prescriptionId);
    }
    return findMockPrescription(prescriptionId);
  }, [flow, prescriptionId, location.state]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void ensureDefaultSelectedAddressIfNeeded();
  }, []);

  const placeOrder = useCallback(async () => {
    if (!rx || !flow) return;
    await ensureDefaultSelectedAddressIfNeeded();
    const addressId = resolvePharmacyOrderAddressId(flow);
    if (!addressId) {
      toast.error("Choose a delivery address.");
      return;
    }
    setBusy(true);
    try {
      await postMedicineOrder({
        address_id: addressId,
        prescriptions: [
          {
            type: "FLIPHEALTH",
            prescription_id: (rx.appointmentId?.trim() || rx.prescriptionId).trim(),
          },
        ],
        patient_id: flow.patientId,
      });
      void navigate(ROUTES.pharmacyOrderSuccess, { state: passState });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not place order");
    } finally {
      setBusy(false);
    }
  }, [flow, navigate, passState, rx, toast]);

  if (!rx || !flow) {
    return (
      <div className="ph-page">
        <header className="ph-top-wrap">
          <div className="ph-top">
            <Link to={ROUTES.pharmacySelectPrescription} state={passState} className="ph-back" aria-label="Back">
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
            <h1 className="ph-title">Prescription Detail</h1>
            <span className="ph-top__spacer" aria-hidden />
          </div>
        </header>
        <div className="ph-page__main">
          <div className="ph-error">
            <div className="ph-error-illu" aria-hidden>
              <img src={PHARMACY_IMAGES.dialogError} alt="" />
            </div>
            Prescription not found. Open Flip Health prescriptions from the pharmacy flow to load this page.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ph-page ph-page--rx-detail">
      <header className="ph-top-wrap">
        <div className="ph-top">
          <Link to={ROUTES.pharmacySelectPrescription} state={passState} className="ph-back" aria-label="Back">
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
          <h1 className="ph-title">Prescription Detail</h1>
          <span className="ph-top__spacer" aria-hidden />
        </div>
      </header>

      <main className="ph-page__main">
        <div className="ph-detail-hero" aria-hidden>
          <img src={PHARMACY_IMAGES.prescriptionDetail} alt="" />
        </div>

        <article className="ph-detail-doc-card">
          <div className="ph-detail-doc-card__avatar" aria-hidden>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="ph-detail-doc-card__body">
            <h2 className="ph-detail-doc-card__name">{rx.doctorName}</h2>
            <p className="ph-detail-doc-card__spec">{rx.specialty}</p>
            <div className="ph-detail-doc-card__chips">
              <span className="ph-detail-doc-card__chip">📅 {rx.dateLabel}</span>
              <span className="ph-detail-doc-card__chip">💊 {rx.medicineCount} medicines</span>
            </div>
          </div>
        </article>

        <section className="ph-detail-clinical" aria-label="Clinical summary">
          <div className="ph-detail-clinical__block">
            <div className="ph-detail-clinical__label">Symptoms</div>
            <div className="ph-detail-clinical__value">{dash(rx.symptoms)}</div>
          </div>
          <div className="ph-detail-clinical__rule" aria-hidden />
          <div className="ph-detail-clinical__block">
            <div className="ph-detail-clinical__label">Diagnosis</div>
            <div className="ph-detail-clinical__value">{dash(rx.diagnosis)}</div>
          </div>
          <div className="ph-detail-clinical__rule" aria-hidden />
          <div className="ph-detail-clinical__block">
            <div className="ph-detail-clinical__label">Recommendation</div>
            <div className="ph-detail-clinical__value ph-detail-clinical__value--multiline">{dash(rx.recommendation)}</div>
          </div>
        </section>

        <section className="ph-med-section ph-med-section--detail" aria-labelledby="ph-meds-title">
          <div className="ph-med-section__head ph-med-section__head--detail">
            <h2 id="ph-meds-title" className="ph-med-section__title ph-med-section__title--with-icon">
              <span className="ph-med-kit-icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="8" width="18" height="12" rx="2" stroke="#e53935" strokeWidth="1.75" />
                  <path d="M9 8V6a3 3 0 016 0v2" stroke="#e53935" strokeWidth="1.75" />
                  <path d="M12 11v6M9 14h6" stroke="#e53935" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </span>
              Medicines
            </h2>
            <span className="ph-med-section__badge ph-med-section__badge--orange">{rx.medicines.length}</span>
          </div>

          {rx.medicines.map((m, i) => {
            const slots = slotsFromSchedule(m.schedule);
            const weeklyChip = weeklyChipText(m.schedule);
            const rowMod = slotRowMod(slots.length);
            return (
              <div key={`${m.name}-${i}`} className="ph-detail-med-card">
                <span className="ph-detail-med-card__tag">{m.form}</span>
                <div className="ph-detail-med-card__name">{m.name}</div>
                <div className="ph-detail-med-card__meta">
                  <span className="ph-detail-meta-chip">🕐 {m.durationLabel}</span>
                  {weeklyChip ? <span className="ph-detail-meta-chip">↻ {weeklyChip}</span> : null}
                </div>
                {slots.length > 0 ? (
                  <div className={`ph-detail-slot-row ph-detail-slot-row--${rowMod}`}>
                    {slots.map((s) => (
                      <div key={s.key} className={`ph-detail-slot ph-detail-slot--${slotClassSuffix(s.key)}`}>
                        <span className="ph-detail-slot__icon" aria-hidden>
                          {slotEmoji(s.key)}
                        </span>
                        <span className="ph-detail-slot__title">{s.title}</span>
                        <span className="ph-detail-slot__sub">{s.sub}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>

        <section className="ph-detail-notes" aria-label="Prescription notes">
          <div className="ph-detail-notes__head">
            <span className="ph-detail-notes__ic" aria-hidden>
              📝
            </span>
            Notes
          </div>
          <p className="ph-detail-notes__body">{dash(rx.notes)}</p>
        </section>
      </main>

      <div className="ph-footer-btn">
        <button type="button" className="ph-footer-btn__inner" disabled={busy} onClick={() => void placeOrder()}>
          {busy ? "Placing…" : "Select & Place Order"}
        </button>
      </div>
    </div>
  );
}
