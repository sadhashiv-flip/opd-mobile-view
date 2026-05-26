import { PharmacyOrderingMemberSheet } from "@/components/pharmacy/PharmacyOrderingMemberSheet";
import { VaccinationAddressBar } from "@/components/vaccination/VaccinationAddressBar";
import { ensureDefaultSelectedAddressIfNeeded } from "@/api/patientAddress";
import { fetchAllPatientMembers } from "@/api/patientMember";
import { fetchAnySubscriptionCanActivate } from "@/api/patientSubscriptions";
import { patientMembersToGymRows, type GymMemberListRow } from "@/lib/gymMemberDisplay";
import {
  readSelectedAddress,
  subscribeSelectedAddress,
} from "@/constants/selectedAddressStorage";
import {
  readPharmacyFlowState,
  writePharmacyFlowState,
  type PharmacyFlowState,
} from "@/constants/pharmacyFlowStorage";
import { PHARMACY_IMAGES } from "@/assets/images/pharmacy";
import { writePharmacyReviewDraft } from "@/constants/pharmacyReviewDraft";
import { ROUTES } from "@/constants";
import { buildPharmacyPassState, readPharmacyHubReturn } from "@/lib/pharmacyFlowNav";
import { useToast } from "@/hooks/useToast";
import { useSelectedAddressSnapshot } from "@/hooks/useSelectedAddressLine";
import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./PharmacyPages.css";
import "@/components/vaccination/VaccinationAddressBar.css";


/** Copy aligned with Flutter `AppString` / `PharmacyMainScreen`. */
const MAIN_COPY = {
  disclaimer:
    "Medicine delivery timelines vary depending on factors like location, type of medication, order timing, and quantity ordered.",
  orderMedsTitle: "Order your medicines",
  orderMedsSub: "Choose how you'd like to share your prescription",
  uploadTitle: "Upload Prescription",
  uploadSub: "Image or File",
  flipTitle: "Fliphealth Prescription",
  flipSub: "Use a prescription from your consultations",
  dontHavePrescription: "Don't have a prescription?",
  safeNote: "Your prescription is safe with us",
  otcSectionTitle: "Need Over The Counter(OTC) Products?",
  otcSectionSub: "No prescription needed",
  otcTitle: "Request OTC Products",
  otcSub: "No prescription needed",
  addressLoadingTitle: "Loading addresses",
  addressLoadingBody: "Please wait while we load your saved addresses.",
  addressRequiredTitle: "Delivery address required",
  noAddressSelected: "No delivery address selected. Add one to continue.",
  addAddressToContinue: "Add an address to continue",
} as const;

const BENEFITS: readonly { readonly id: string; readonly label: string }[] = [
  { id: "ship", label: "Secure home delivery" },
  { id: "clock", label: "Delivery in 24-48 hours" },
  { id: "shield", label: "Contactless delivery" },
] as const;

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

function PharmacyBenefitIcon({ id }: Readonly<{ id: string }>) {
  if (id === "ship") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M1 3h8l1 4h10v8H1V3zM1 11h20M5 19a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4z"
          stroke="#ff541e"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (id === "clock") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="#ff541e" strokeWidth="1.5" />
        <path d="M12 7v5l3 2" stroke="#ff541e" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l7 4v5c0 5-3 9-7 11-4-2-7-6-7-11V7l7-4z"
        stroke="#ff541e"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" stroke="#ff541e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

  const hubReturn = readPharmacyHubReturn(location);

  const [flow, setFlow] = useState<PharmacyFlowState | null>(() => readPharmacyFlowState());
  const [members, setMembers] = useState<GymMemberListRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [memberSheetOpen, setMemberSheetOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [showFlipHealth, setShowFlipHealth] = useState(false);
  const [addressesBootstrapped, setAddressesBootstrapped] = useState(false);
  const selectedAddress = useSelectedAddressSnapshot();

  const addressesLoading = !addressesBootstrapped;
  const deliveryAddressReady =
    addressesBootstrapped && Boolean(selectedAddress?.id?.trim());

  const passState = useMemo(
    () => buildPharmacyPassState(hubReturn, ROUTES.pharmacy),
    [hubReturn],
  );

  const orderingForLabel = useMemo(() => {
    if (!flow) return "";
    const row = members.find((m) => m.id === flow.memberId);
    const suffix = row?.section === "self" ? " (self)" : "";
    return `${flow.patientName}${suffix}`;
  }, [flow, members]);

  const ensurePharmacyAddress = useCallback((): boolean => {
    if (addressesLoading) {
      toast.error("Please wait — loading addresses…");
      return false;
    }
    if (!deliveryAddressReady) {
      toast.error(MAIN_COPY.noAddressSelected);
      return false;
    }
    return true;
  }, [addressesLoading, deliveryAddressReady, toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureDefaultSelectedAddressIfNeeded();
      if (!cancelled) setAddressesBootstrapped(true);
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
          const [list, canAct] = await Promise.all([
            fetchAllPatientMembers(),
            fetchAnySubscriptionCanActivate(),
          ]);
          if (!cancelled) setMembers(patientMembersToGymRows(list, { subscriptionCanActivate: canAct }));
        } catch {
          if (!cancelled) setMembers([]);
        } finally {
          if (!cancelled) setLoadingMembers(false);
        }
        return;
      }

      setLoadingMembers(true);
      try {
        const [list, canAct] = await Promise.all([
          fetchAllPatientMembers(),
          fetchAnySubscriptionCanActivate(),
        ]);
        if (cancelled) return;
        const rows = patientMembersToGymRows(list, { subscriptionCanActivate: canAct });
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

  const goToOtcReview = useCallback(() => {
    const cur = readPharmacyFlowState();
    if (!cur) {
      toast.error("Select who you are ordering for.");
      return;
    }
    if (!ensurePharmacyAddress()) return;
    writePharmacyReviewDraft({ kind: "OTC" });
    void navigate(ROUTES.pharmacyReview, {
      state: { ...passState, backPath: ROUTES.pharmacy, orderKind: "OTC" as const },
    });
  }, [ensurePharmacyAddress, navigate, passState, toast]);

  const goToUpload = useCallback(() => {
    if (!ensurePharmacyAddress()) return;
    void navigate(ROUTES.pharmacyUpload, {
      state: buildPharmacyPassState(hubReturn, ROUTES.pharmacy),
    });
  }, [ensurePharmacyAddress, hubReturn, navigate]);

  const goToFlipHealth = useCallback(() => {
    if (!ensurePharmacyAddress()) return;
    void navigate(ROUTES.pharmacySelectPrescription, {
      state: buildPharmacyPassState(hubReturn, ROUTES.pharmacy),
    });
  }, [ensurePharmacyAddress, hubReturn, navigate]);

  const showAddressBanner = flow && (addressesLoading || !deliveryAddressReady);

  return (
    <div className="ph-page ph-page--dart-main">
      <header className="ph-top-wrap ph-top-wrap--dart-main">
        <div className="ph-top ph-top--dart-main">
          <FlowScreenBack fallbackTo={hubReturn} className="ph-back" />
          <div className="ph-top-loc">
            <VaccinationAddressBar />
          </div>
        </div>
      </header>

      <main className="ph-page__main ph-page__main--dart-main">
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
              className="ph-member-card ph-member-card--dart-main"
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

            <ul className="ph-main-benefits">
              {BENEFITS.map((b) => (
                <li key={b.id} className="ph-main-benefits__chip">
                  <PharmacyBenefitIcon id={b.id} />
                  <span>{b.label}</span>
                </li>
              ))}
            </ul>

            <p className="ph-main-disclaimer">{MAIN_COPY.disclaimer}</p>

            {showAddressBanner ? (
              <div
                className={`ph-main-address-banner${addressesLoading ? " ph-main-address-banner--info" : " ph-main-address-banner--warn"}`}
                role="status"
              >
                <span className="ph-main-address-banner__icon" aria-hidden>
                  {addressesLoading ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 21s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M12 14v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </span>
                <span className="ph-main-address-banner__text">
                  <span className="ph-main-address-banner__title">
                    {addressesLoading
                      ? MAIN_COPY.addressLoadingTitle
                      : MAIN_COPY.addressRequiredTitle}
                  </span>
                  <span className="ph-main-address-banner__body">
                    {addressesLoading
                      ? MAIN_COPY.addressLoadingBody
                      : MAIN_COPY.noAddressSelected}
                  </span>
                </span>
              </div>
            ) : null}

            <header className="ph-main-section-head">
              <h2 className="ph-main-section-head__title">{MAIN_COPY.orderMedsTitle}</h2>
              <p className="ph-main-section-head__sub">{MAIN_COPY.orderMedsSub}</p>
            </header>

            <div
              className={`ph-main-options${deliveryAddressReady ? "" : " ph-main-options--dimmed"}`}
            >
              <button type="button" className="ph-main-opt-tile" onClick={goToUpload}>
                <span className="ph-main-opt-tile__icon-wrap" aria-hidden>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                      stroke="#ff541e"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3" stroke="#ff541e" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="ph-main-opt-tile__text">
                  <span className="ph-main-opt-tile__title">{MAIN_COPY.uploadTitle}</span>
                  <span className="ph-main-opt-tile__sub">{MAIN_COPY.uploadSub}</span>
                </span>
                <span className="ph-main-opt-tile__arrow" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>

              {showFlipHealth ? (
                <button type="button" className="ph-main-opt-tile" onClick={goToFlipHealth}>
                  <span className="ph-main-opt-tile__icon-wrap" aria-hidden>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 4v4m6 2v6a6 6 0 01-12 0V10m12 0a6 6 0 10-12 0"
                        stroke="#ff541e"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                      />
                      <path d="M10 14h4" stroke="#ff541e" strokeWidth="1.75" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="ph-main-opt-tile__text">
                    <span className="ph-main-opt-tile__title">{MAIN_COPY.flipTitle}</span>
                    <span className="ph-main-opt-tile__sub">{MAIN_COPY.flipSub}</span>
                  </span>
                  <span className="ph-main-opt-tile__arrow" aria-hidden>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className="ph-main-flip-reveal"
                  onClick={() => setShowFlipHealth(true)}
                >
                  <span>{MAIN_COPY.dontHavePrescription}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}

              <div className="ph-main-safe">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M8 11V8a4 4 0 118 0v3M7 11h10v9H7V11z"
                    stroke="#1976d2"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p>{MAIN_COPY.safeNote}</p>
              </div>
            </div>

            <header className="ph-main-section-head ph-main-section-head--otc">
              <h2 className="ph-main-section-head__title">{MAIN_COPY.otcSectionTitle}</h2>
              <p className="ph-main-section-head__sub">{MAIN_COPY.otcSectionSub}</p>
            </header>

            {!deliveryAddressReady && !addressesLoading ? (
              <p className="ph-main-otc-cue" role="status">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 8v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="12" cy="16" r="0.75" fill="currentColor" />
                </svg>
                <span>{MAIN_COPY.addAddressToContinue}</span>
              </p>
            ) : null}

            <button
              type="button"
              className={`ph-main-otc-tile${deliveryAddressReady ? "" : " ph-main-otc-tile--dimmed"}`}
              onClick={() => goToOtcReview()}
            >
              <span className="ph-main-opt-tile__icon-wrap" aria-hidden>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 11V7a3 3 0 016 0v4M5 9h14v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9z"
                    stroke="#ff541e"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="ph-main-opt-tile__text">
                <span className="ph-main-opt-tile__title">{MAIN_COPY.otcTitle}</span>
                <span className="ph-main-opt-tile__sub">{MAIN_COPY.otcSub}</span>
              </span>
              <span className="ph-main-opt-tile__arrow" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>

            <section className="ph-main-faq" aria-labelledby="ph-main-faq-title">
              <div className="ph-main-faq__head">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 22a10 10 0 100-20 10 10 0 000 20zm0-17v2m0 12v-6"
                    stroke="#ff541e"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="16" r="0.75" fill="#ff541e" />
                </svg>
                <h2 id="ph-main-faq-title" className="ph-main-faq__title">
                  FAQ
                </h2>
              </div>
              <div className="ph-main-faq__card">
                {FAQS.map((item, i) => {
                  const open = faqOpen === i;
                  return (
                    <div key={item.q} className="ph-main-faq__block">
                      <button
                        type="button"
                        className={`ph-main-faq__q${open ? " ph-main-faq__q--open" : ""}`}
                        onClick={() => setFaqOpen(open ? null : i)}
                        aria-expanded={open}
                      >
                        <span className="ph-main-faq__q-text">{item.q}</span>
                        <span className={`ph-main-faq__chev${open ? " ph-main-faq__chev--open" : ""}`} aria-hidden>
                          ⌄
                        </span>
                      </button>
                      {open ? <p className="ph-main-faq__a">{item.a}</p> : null}
                    </div>
                  );
                })}
              </div>
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

    </div>
  );
}
