import { PharmacyOrderingMemberSheet } from "@/components/pharmacy/PharmacyOrderingMemberSheet";
import { VaccinationAddressBar } from "@/components/vaccination/VaccinationAddressBar";
import { ensureDefaultSelectedAddressIfNeeded } from "@/api/patientAddress";
import { fetchAllPatientMembers } from "@/api/patientMember";
import { patientMembersToGymRows, type GymMemberListRow } from "@/lib/gymMemberDisplay";
import { readSelectedAddress, subscribeSelectedAddress } from "@/constants/selectedAddressStorage";
import {
  readPharmacyFlowState,
  resolvePharmacyOrderAddressId,
  writePharmacyFlowState,
  type PharmacyFlowState,
} from "@/constants/pharmacyFlowStorage";
import { postMedicineOrder } from "@/api/pharmacy";
import { PHARMACY_IMAGES } from "@/assets/images/pharmacy";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./PharmacyPages.css";
import "@/components/vaccination/VaccinationAddressBar.css";

type NavState = Readonly<{ returnPath?: string }>;

const FAQS = [
  {
    q: "Do I need to order all the medicine in the prescription?",
    a: "No, you don't need to order all medicines. Our medicine partner will contact you to confirm the required medicines.",
  },
  {
    q: "Can I change the quantity of medicines?",
    a: "Yes, our medicine partner will contact you to confirm the medicines and quantities before delivery.",
  },
  {
    q: "How do I know the price of medicines?",
    a: "Once the order is confirmed, our medicine partner will share the price details with you before delivery.",
  },
] as const;

function flowWithSyncedAddress(cur: PharmacyFlowState): PharmacyFlowState {
  const sel = readSelectedAddress()?.id?.trim();
  if (sel && sel !== cur.addressId) return { ...cur, addressId: sel };
  if (!sel && cur.addressId) {
    return { memberId: cur.memberId, patientName: cur.patientName, patientId: cur.patientId };
  }
  return cur;
}

export function PharmacyDeliveryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const hubReturn = (location.state as NavState | null)?.returnPath ?? ROUTES.dashboard;

  const [flow, setFlow] = useState<PharmacyFlowState | null>(() => readPharmacyFlowState());
  const [members, setMembers] = useState<GymMemberListRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [memberSheetOpen, setMemberSheetOpen] = useState(false);
  const [otcOpen, setOtcOpen] = useState(false);
  const [otcBusy, setOtcBusy] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const passState = useMemo(() => ({ returnPath: hubReturn } satisfies NavState), [hubReturn]);

  const orderingForLabel = useMemo(() => {
    if (!flow) return "";
    const row = members.find((m) => m.id === flow.memberId);
    const suffix = row?.section === "self" ? " (self)" : "";
    return `${flow.patientName}${suffix}`;
  }, [flow, members]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureDefaultSelectedAddressIfNeeded();
      const existing = readPharmacyFlowState();
      if (existing) {
        const synced = flowWithSyncedAddress(existing);
        if (synced !== existing) {
          writePharmacyFlowState(synced);
        }
        if (!cancelled) {
          setFlow(synced);
        }
        try {
          const list = await fetchAllPatientMembers();
          if (!cancelled) setMembers(patientMembersToGymRows(list));
        } catch {
          if (!cancelled) setMembers([]);
        } finally {
          if (!cancelled) setLoadingMembers(false);
        }
        return;
      }

      setLoadingMembers(true);
      try {
        const list = await fetchAllPatientMembers();
        if (cancelled) return;
        const rows = patientMembersToGymRows(list);
        setMembers(rows);
        const self = rows.find((r) => r.section === "self") ?? rows[0];
        if (!self || self.userId == null) {
          toast.error("Could not resolve a member for this order. Add a profile or try again.");
          setFlow(null);
          return;
        }
        const selAddr = readSelectedAddress()?.id?.trim();
        const next: PharmacyFlowState = {
          memberId: self.id,
          patientName: self.name,
          patientId: self.userId,
          ...(selAddr ? { addressId: selAddr } : {}),
        };
        writePharmacyFlowState(next);
        setFlow(next);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Could not load family members");
          setFlow(null);
        }
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    return subscribeSelectedAddress(() => {
      const cur = readPharmacyFlowState();
      if (!cur) return;
      const synced = flowWithSyncedAddress(cur);
      if (synced === cur) return;
      writePharmacyFlowState(synced);
      setFlow(synced);
    });
  }, []);

  const selectMember = useCallback(
    (row: GymMemberListRow) => {
      if (row.userId == null) {
        toast.error("This member is missing a user id. Update the profile and try again.");
        return;
      }
      const prev = readPharmacyFlowState();
      const selAddr = readSelectedAddress()?.id?.trim();
      const keepAddr = selAddr ?? prev?.addressId?.trim();
      const next: PharmacyFlowState = {
        memberId: row.id,
        patientName: row.name,
        patientId: row.userId,
        ...(keepAddr ? { addressId: keepAddr } : {}),
      };
      writePharmacyFlowState(next);
      setFlow(next);
      setMemberSheetOpen(false);
    },
    [toast],
  );

  const confirmOtc = useCallback(async () => {
    const cur = readPharmacyFlowState();
    if (!cur) {
      toast.error("Select who you are ordering for.");
      return;
    }
    await ensureDefaultSelectedAddressIfNeeded();
    const addressId = resolvePharmacyOrderAddressId(readPharmacyFlowState());
    if (!addressId) {
      toast.error("Choose a delivery address.");
      return;
    }
    setOtcBusy(true);
    try {
      await postMedicineOrder({
        address_id: addressId,
        prescriptions: [],
        patient_id: cur.patientId,
      });
      setOtcOpen(false);
      void navigate(ROUTES.pharmacyOrderSuccess, { state: passState });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not place order");
    } finally {
      setOtcBusy(false);
    }
  }, [navigate, passState, toast]);

  return (
    <div className="ph-page">
      <header className="ph-top-wrap">
        <div className="ph-top">
          <Link to={hubReturn} className="ph-back" aria-label="Back">
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
          <h1 className="ph-title">Pharmacy Delivery</h1>
          <span className="ph-top__spacer" aria-hidden />
        </div>
      </header>

      <div className="ph-strip">
        <div className="ph-strip__inner">
          <VaccinationAddressBar />
        </div>
      </div>

      <main className="ph-page__main">
        {loadingMembers ? <div className="ph-loading">Loading…</div> : null}
        {!loadingMembers && !flow ? (
          <div className="ph-error">
            <div className="ph-error-illu" aria-hidden>
              <img src={PHARMACY_IMAGES.dialogError} alt="" />
            </div>
            We could not start pharmacy ordering. Go back and try again.
          </div>
        ) : null}

        {flow ? (
          <>
            <button
              type="button"
              className="ph-member-card"
              onClick={() => setMemberSheetOpen(true)}
              aria-label="Change who this order is for"
            >
              <span className="ph-member-card__text">
                <span className="ph-member-card__label">Ordering for</span>
                <span className="ph-member-card__name">{orderingForLabel}</span>
              </span>
              <span className="ph-member-card__chev" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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

            <section className="ph-hero" aria-labelledby="ph-hero-title">
              <div className="ph-hero__row">
                <div className="ph-hero__copy">
                  <h2 id="ph-hero-title" className="ph-hero__title">
                    Flip Health Delivery
                  </h2>
                  <ul className="ph-hero__list">
                    <li>Secure home delivery</li>
                    <li>Delivery in 24 hours</li>
                    <li>Contactless delivery</li>
                  </ul>
                </div>
                <div className="ph-hero__art" aria-hidden>
                  <img src={PHARMACY_IMAGES.medicineDelivery} alt="" />
                </div>
              </div>
            </section>

            <p className="ph-note">Medicines will be delivered within 24-48 hours of placing order</p>

            <section className="ph-upload-section" aria-labelledby="ph-upload-heading">
              <h2 id="ph-upload-heading" className="ph-section-title ph-section-title--in-pink">
                Upload Prescription
              </h2>
              <p className="ph-section-sub">Your prescription is safe with us</p>

              <div className="ph-two-col">
                <div className="ph-opt-card">
                  <div className="ph-opt-card__art" aria-hidden>
                    <img src={PHARMACY_IMAGES.uploadPrescription} alt="" />
                  </div>
                  <p className="ph-opt-card__label">Image or File</p>
                  <button
                    type="button"
                    className="ph-btn-orange"
                    onClick={() => void navigate(ROUTES.pharmacyUpload, { state: passState })}
                  >
                    Upload 
                  </button>
                </div>
                <div className="ph-opt-card">
                  <div className="ph-opt-card__art" aria-hidden>
                    <img src={PHARMACY_IMAGES.flipHealthPrescription} alt="" />
                  </div>
                  <p className="ph-opt-card__label">Fliphealth Prescription</p>
                  <button
                    type="button"
                    className="ph-btn-orange"
                    onClick={() => void navigate(ROUTES.pharmacySelectPrescription, { state: passState })}
                  >
                    Select 
                  </button>
                </div>
              </div>
            </section>

            <div className="ph-otc-card">
              <div className="ph-otc-card__row">
                <div className="ph-otc-card__art" aria-hidden>
                  <img src={PHARMACY_IMAGES.otcProducts} alt="" />
                </div>
                <div className="ph-otc-card__copy">
                  <h2 className="ph-otc-card__title">Request OTC Products</h2>
                  <p className="ph-otc-card__sub">No prescription needed</p>
                  <button type="button" className="ph-btn-orange ph-btn-orange--otc" onClick={() => setOtcOpen(true)}>
                    Order Now
                  </button>
                </div>
              </div>
            </div>

            <section className="ph-faq" aria-labelledby="ph-faq-title">
              <h2 id="ph-faq-title" className="ph-section-title">
                FAQ
              </h2>
              {FAQS.map((item, i) => {
                const open = faqOpen === i;
                return (
                  <div key={item.q} className="ph-faq__item">
                    <button
                      type="button"
                      className="ph-faq__q"
                      onClick={() => setFaqOpen(open ? null : i)}
                      aria-expanded={open}
                    >
                      {item.q}
                      <span className={`ph-faq__chev${open ? " ph-faq__chev--open" : ""}`} aria-hidden>
                        ⌄
                      </span>
                    </button>
                    {open ? <p className="ph-faq__a">{item.a}</p> : null}
                  </div>
                );
              })}
            </section>
          </>
        ) : null}
      </main>

      {memberSheetOpen ? (
        <PharmacyOrderingMemberSheet
          open={memberSheetOpen}
          onClose={() => setMemberSheetOpen(false)}
          members={members}
          loading={loadingMembers}
          selectedMemberId={flow?.memberId ?? null}
          onApply={selectMember}
        />
      ) : null}

      {otcOpen ? (
        <div className="ph-modal-overlay" role="presentation" onClick={() => !otcBusy && setOtcOpen(false)}>
          <div
            className="ph-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ph-otc-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ph-modal__art" aria-hidden>
              <img src={PHARMACY_IMAGES.dialogConfirm} alt="" />
            </div>
            <h2 id="ph-otc-title" className="ph-modal__title">
              Request OTC Products
            </h2>
            <p className="ph-modal__text">
              Place an order for OTC products? Our team will contact you to confirm.
            </p>
            <div className="ph-modal__actions">
              <button type="button" className="ph-btn-grey" disabled={otcBusy} onClick={() => setOtcOpen(false)}>
                Cancel
              </button>
              <button type="button" className="ph-btn-orange" disabled={otcBusy} onClick={() => void confirmOtc()}>
                {otcBusy ? "…" : "Place Order"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
