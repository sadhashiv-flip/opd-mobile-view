import { ROUTES } from "@/constants";
import myOrdersSvg from "@/assets/icons/common/MyOrders.svg";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import {
  DIAG_LAB_SLOT_PAYLOAD_KEY,
  DIAG_LAB_VENDOR_NAME_KEY,
} from "@/constants/diagnosticsLabFlowStorage";
import { readDiagnosticsSelectedMembersSnapshots } from "@/constants/diagnosticsSelectedMemberStorage";
import {
  DEFAULT_LOCATION_ADDRESS_LINE,
  readSelectedAddress,
  subscribeSelectedAddress,
} from "@/constants/selectedAddressStorage";
import { useSelectedAddressLine } from "@/hooks/useSelectedAddressLine";
import { useToast } from "@/hooks/useToast";
import { useDiagnosticsRazorpayConfirm } from "@/hooks/useDiagnosticsRazorpayConfirm";
import { confirmDiagnosticsOrder } from "@/api/patientDiagnosticsOrderConfirm";
import {
  normalizeBookingOverviewPayload,
  parseBookingInvoiceId,
  parseDiagnosticsFinalizeResponse,
  postDiagnosticsBooking,
  postDiagnosticsHealthBooking,
  type DiagnosticSlotPick,
  type DiagnosticsBookingBody,
  type DiagnosticsHealthBookingBody,
  type NormalizedBookingOverview,
} from "@/api/patientDiagnosticsLab";
import {
  readHealthPathologySlotJson,
  readHealthRadiologySlotJson,
  readHealthSponsoredFlag,
  readHealthUsersPackages,
  readHealthVendorMeta,
} from "@/constants/diagnosticsHealthFlowStorage";
import { DIAGNOSTICS_PAYMENT_DONE_EVENT } from "@/constants/windowPaymentEvents";
import {
  isPaymentCancelledMessage,
  loadRazorpayScript,
  normalizeRazorpayCheckoutPayload,
  openRazorpayCheckoutWithEvent,
} from "@/lib/razorpayCheckout";
import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import "./HealthCheckupsOverviewPage.css";

const LAB_OVERVIEW_ADDRESS =
  "iSprout, 7th floor, Plot No: 28, Divyasree Trinity, near Hexagon Capability Center, 5 & 6, Hitech City, Hyderabad, Telangana 500081";

function formatInr(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function readSlotPayload(): DiagnosticSlotPick | null {
  try {
    const raw = localStorage.getItem(DIAG_LAB_SLOT_PAYLOAD_KEY);
    if (!raw?.trim()) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const o = p as Record<string, unknown>;
    const slot_id = String(o.slot_id ?? "");
    const vendor_code = String(o.vendor_code ?? "");
    const slot_date = String(o.slot_date ?? "");
    const start_time = String(o.start_time ?? "");
    const end_time = String(o.end_time ?? "");
    if (!slot_id || !vendor_code || !slot_date || !start_time) return null;
    return { slot_id, vendor_code, slot_date, start_time, end_time };
  } catch {
    return null;
  }
}

function parseStoredHealthSlot(raw: string | null): DiagnosticSlotPick | null {
  if (!raw?.trim()) return null;
  try {
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const o = p as Record<string, unknown>;
    const slot_id = String(o.slot_id ?? "");
    const vendor_code = String(o.vendor_code ?? "");
    const slot_date = String(o.slot_date ?? "");
    const start_time = String(o.start_time ?? "");
    const end_time = String(o.end_time ?? "");
    if (!slot_id || !vendor_code || !slot_date || !start_time) return null;
    return { slot_id, vendor_code, slot_date, start_time, end_time };
  } catch {
    return null;
  }
}

export function HealthCheckupsOverviewPage() {
  const navigate = useNavigate();
  const params = useParams();
  const toast = useToast();
  const type = typeof params.type === "string" ? params.type : "health-checkups";
  const isLabTests = type === "lab-tests";
  const locAddrLine = useSelectedAddressLine(
    isLabTests ? LAB_OVERVIEW_ADDRESS : DEFAULT_LOCATION_ADDRESS_LINE,
  );

  const selectedAddressId = useSyncExternalStore(
    subscribeSelectedAddress,
    () => readSelectedAddress()?.id?.trim() ?? "",
    () => "",
  );

  const vendorId = useMemo(() => {
    try {
      return localStorage.getItem("opd-mobile-view.diagnostics.vendorId") ?? "";
    } catch {
      return "";
    }
  }, []);

  const slotLabel = useMemo(() => {
    try {
      return localStorage.getItem("opd-mobile-view.diagnostics.slotLabel") ?? "";
    } catch {
      return "";
    }
  }, []);

  const dateLabel = useMemo(() => {
    try {
      return localStorage.getItem("opd-mobile-view.diagnostics.date") ?? "";
    } catch {
      return "";
    }
  }, []);

  const [altPhone, setAltPhone] = useState("");
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);

  const [labOverviewLoading, setLabOverviewLoading] = useState(false);
  const [labOverviewError, setLabOverviewError] = useState<string | null>(null);
  const [labOverview, setLabOverview] = useState<NormalizedBookingOverview | null>(null);
  const [labSubmitting, setLabSubmitting] = useState(false);

  const vendorDisplayName = useMemo(() => {
    try {
      return localStorage.getItem(DIAG_LAB_VENDOR_NAME_KEY)?.trim() || "";
    } catch {
      return "";
    }
  }, []);

  const loadLabOverview = useCallback(async () => {
    if (!isLabTests) return;
    const addr = readSelectedAddress();
    const slot = readSlotPayload();
    if (!addr?.id.trim() || !slot) {
      setLabOverview(null);
      setLabOverviewError(!addr?.id.trim() ? "Choose a delivery address." : "Choose a slot first.");
      return;
    }
    const members = readDiagnosticsSelectedMembersSnapshots();
    const users = members
      .map((m) => (typeof m.userId === "number" && Number.isFinite(m.userId) ? { user_id: m.userId } : null))
      .filter((x): x is { user_id: number } => x != null);
    if (users.length === 0) {
      setLabOverview(null);
      setLabOverviewError("Select a person for this booking (go back to member selection).");
      return;
    }
    const body: DiagnosticsBookingBody = {
      address_id: addr.id.trim(),
      sponsored: false,
      alternative_phone: altPhone.trim(),
      slot,
      users,
    };
    setLabOverviewLoading(true);
    setLabOverviewError(null);
    try {
      const raw = await postDiagnosticsBooking(true, body, false);
      const norm = normalizeBookingOverviewPayload(raw);
      setLabOverview(norm);
      if (!norm) setLabOverviewError("Could not read booking summary.");
    } catch (e) {
      setLabOverview(null);
      const msg = e instanceof Error ? e.message : "Could not load summary";
      setLabOverviewError(msg);
      toast.error(msg);
    } finally {
      setLabOverviewLoading(false);
    }
  }, [isLabTests, altPhone, toast]);

  useEffect(() => {
    if (!isLabTests) return;
    const t = window.setTimeout(() => {
      void loadLabOverview();
    }, 400);
    return () => window.clearTimeout(t);
  }, [isLabTests, loadLabOverview, selectedAddressId]);

  const buildHealthBookingBody = useCallback((): DiagnosticsHealthBookingBody | null => {
    const addr = readSelectedAddress();
    const meta = readHealthVendorMeta();
    const users = readHealthUsersPackages();
    if (!addr?.id.trim() || users.length === 0 || !meta) return null;
    const pathSlot = parseStoredHealthSlot(readHealthPathologySlotJson());
    const radSlot = parseStoredHealthSlot(readHealthRadiologySlotJson());
    if (meta?.needPathology && !pathSlot) return null;
    if (meta?.needRadiology && !radSlot) return null;
    const base: DiagnosticsHealthBookingBody = {
      booking_type: "special",
      sponsored: readHealthSponsoredFlag(),
      address_id: addr.id.trim(),
      alternative_phone: altPhone.trim(),
      users,
    };
    return {
      ...base,
      ...(pathSlot ? { pathology_slot: pathSlot } : {}),
      ...(radSlot ? { radiology_slot: radSlot } : {}),
    };
  }, [altPhone]);

  const loadHealthOverview = useCallback(async () => {
    if (isLabTests) return;
    const body = buildHealthBookingBody();
    if (!body) {
      setLabOverview(null);
      setLabOverviewError("Complete package, vendor, and slot steps before review.");
      return;
    }
    setLabOverviewLoading(true);
    setLabOverviewError(null);
    try {
      const raw = await postDiagnosticsHealthBooking(true, body, false);
      const norm = normalizeBookingOverviewPayload(raw);
      setLabOverview(norm);
      if (!norm) setLabOverviewError("Could not read booking summary.");
    } catch (e) {
      setLabOverview(null);
      const msg = e instanceof Error ? e.message : "Could not load summary";
      setLabOverviewError(msg);
      toast.error(msg);
    } finally {
      setLabOverviewLoading(false);
    }
  }, [isLabTests, buildHealthBookingBody, toast]);

  useEffect(() => {
    if (isLabTests) return;
    const t = window.setTimeout(() => {
      void loadHealthOverview();
    }, 400);
    return () => window.clearTimeout(t);
  }, [isLabTests, loadHealthOverview, selectedAddressId]);

  const diagRzpInvoiceIdRef = useRef<string | null>(null);
  const diagRzpSuccessRef = useRef<() => void>(() => {});
  const diagRzpErrorRef = useRef<(message: string) => void>(() => {});

  useDiagnosticsRazorpayConfirm({
    invoiceIdRef: diagRzpInvoiceIdRef,
    onSuccessRef: diagRzpSuccessRef,
    onErrorRef: diagRzpErrorRef,
  });

  diagRzpSuccessRef.current = () => {
    setLabSubmitting(false);
    toast.success("Booking confirmed");
    navigate(generatePath(ROUTES.diagnosticsBookingSuccess, { type }));
  };
  diagRzpErrorRef.current = (message: string) => {
    setLabSubmitting(false);
    toast.error(message);
  };

  const finalizeDiagnosticsCheckout = useCallback(
    async (raw: unknown): Promise<"razorpay" | "done" | "fail"> => {
      const fin = parseDiagnosticsFinalizeResponse(raw);
      const amountToPay = labOverview?.amountToPay ?? null;
      const hasRzpKeys =
        fin.razorpayPayload != null && Object.keys(fin.razorpayPayload).length > 0;
      /** Preview flags only — used when finalize omits a gateway payload (Flutter does not gate on these to open Razorpay). */
      const wantsPay =
        fin.paymentRequired || (amountToPay != null && amountToPay > 0);

      // patient_app `finalizeHealthCheckupBooking`: open Checkout whenever `razorpay_payload` is non-empty.
      if (hasRzpKeys) {
        const invoiceId = fin.invoiceId?.trim() || parseBookingInvoiceId(raw)?.trim() || null;
        if (!invoiceId) {
          toast.error("Missing invoice for payment.");
          return "fail";
        }
        diagRzpInvoiceIdRef.current = invoiceId;
        try {
          await loadRazorpayScript();
        } catch {
          toast.error("Could not load payment gateway.");
          return "fail";
        }
        if (!window.Razorpay) {
          toast.error("Payment gateway is not available.");
          return "fail";
        }
        openRazorpayCheckoutWithEvent(
          normalizeRazorpayCheckoutPayload({ ...fin.razorpayPayload }),
          DIAGNOSTICS_PAYMENT_DONE_EVENT,
          (failMsg) => {
            if (!isPaymentCancelledMessage(failMsg)) toast.error(failMsg);
            diagRzpInvoiceIdRef.current = null;
            setLabSubmitting(false);
          },
        );
        return "razorpay";
      }

      if (wantsPay && !hasRzpKeys) {
        toast.error(
          "Payment is required but checkout could not start. Please try again or complete booking in the main app.",
        );
        return "fail";
      }

      const invoiceId = fin.invoiceId?.trim() || parseBookingInvoiceId(raw)?.trim() || null;
      if (!invoiceId) {
        toast.error("Could not read booking confirmation.");
        return "fail";
      }
      await confirmDiagnosticsOrder({ invoice_id: invoiceId, payment_id: "" });
      diagRzpSuccessRef.current();
      return "done";
    },
    [labOverview?.amountToPay, toast],
  );

  const formattedScheduleDate = useMemo(() => {
    if (!dateLabel) return "April 10, 2024";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateLabel)) {
      const d = new Date(`${dateLabel}T12:00:00`);
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    }
    return dateLabel;
  }, [dateLabel]);

  const dateTimeDisplay = useMemo(() => {
    if (slotLabel) {
      return `${formattedScheduleDate} | ${slotLabel}`;
    }
    return `${formattedScheduleDate} | 2PM-3PM`;
  }, [slotLabel, formattedScheduleDate]);

  const addedItemsCount = Math.max(1, labOverview?.items.length ?? 1);

  const onLabConfirm = async () => {
    if (!isLabTests || labSubmitting) return;
    const addr = readSelectedAddress();
    const slot = readSlotPayload();
    if (!addr?.id.trim() || !slot) {
      toast.error("Missing address or slot.");
      return;
    }
    const members = readDiagnosticsSelectedMembersSnapshots();
    const users = members
      .map((m) => (typeof m.userId === "number" && Number.isFinite(m.userId) ? { user_id: m.userId } : null))
      .filter((x): x is { user_id: number } => x != null);
    if (users.length === 0) {
      toast.error("Select a person for this booking.");
      return;
    }
    const body: DiagnosticsBookingBody = {
      address_id: addr.id.trim(),
      sponsored: false,
      alternative_phone: altPhone.trim(),
      slot,
      users,
    };
    setLabSubmitting(true);
    let keepSubmitting = false;
    try {
      const raw = await postDiagnosticsBooking(false, body, false);
      const r = await finalizeDiagnosticsCheckout(raw);
      if (r === "razorpay") keepSubmitting = true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
    } finally {
      if (!keepSubmitting) setLabSubmitting(false);
    }
  };

  const onHealthConfirm = async () => {
    if (isLabTests || labSubmitting) return;
    const body = buildHealthBookingBody();
    if (!body) {
      toast.error("Missing booking details.");
      return;
    }
    setLabSubmitting(true);
    let keepSubmitting = false;
    try {
      const raw = await postDiagnosticsHealthBooking(false, body, false);
      const r = await finalizeDiagnosticsCheckout(raw);
      if (r === "razorpay") keepSubmitting = true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
    } finally {
      if (!keepSubmitting) setLabSubmitting(false);
    }
  };

  return (
    <div className="hco-page hco-page--lab">
      <header className="hco-top">
        <Link
          to={generatePath(ROUTES.diagnosticsSlots, { type })}
          className="hco-back"
          aria-label="Back to slots"
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
        <h1 className="hco-title">{isLabTests ? "Cart Overview" : "Booking summary"}</h1>
        {isLabTests ? (
          <span className="hco-top__balance" aria-hidden="true" />
        ) : (
          <Link to={ROUTES.orders} className="hco-orders">
            <span className="hco-orders__ic" aria-hidden="true">
              <img src={myOrdersSvg} alt="" width={14} height={14} draggable={false} />
            </span>
            <span>My Orders</span>
          </Link>
        )}
      </header>

      <button
        type="button"
        className={`hco-loc${isLabTests ? " hco-loc--multiline" : ""}`}
        aria-label="Choose delivery address"
        onClick={() => setAddrSheetOpen(true)}
      >
        <span className="hco-loc__pin" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 22s7-5.1 7-12a7 7 0 10-14 0c0 6.9 7 12 7 12z"
              fill="#FF541E"
            />
            <circle cx="12" cy="10" r="2.5" fill="#ffffff" opacity="0.95" />
          </svg>
        </span>
        <div className="hco-loc__body">
          <span className="hco-loc__title">Home</span>
          <span className="hco-loc__sep" aria-hidden="true">
            |
          </span>
          <span className="hco-loc__addr">{locAddrLine}</span>
        </div>
        <span className="hco-loc__chev" aria-hidden="true">
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

      <AddressBottomSheet open={addrSheetOpen} onClose={() => setAddrSheetOpen(false)} />

      <main className="hco-main">
        <div className="hco-main__inner">
            <div className="hco-main__content">
              <div className="hco-subhead">
                <span className="hco-subhead__title">Added Items({addedItemsCount})</span>
              </div>

              {labOverviewLoading ? <p className="hco-help">Loading booking summary…</p> : null}
              {labOverviewError ? (
                <p className="hco-help" role="alert">
                  {labOverviewError}
                </p>
              ) : null}

              {labOverview?.items.map((it, idx) => (
                <section key={`${it.name}-${String(idx)}`} className="hco-item">
                  <div className="hco-item__row">
                    <div className="hco-item__text">
                      <div className="hco-item__name">{it.name}</div>
                      <div className="hco-item__meta">
                        {isLabTests
                          ? vendorDisplayName || vendorId || "Lab partner"
                          : labOverview?.vendorName || vendorId || "Diagnostics partner"}
                        {it.qty > 1 ? ` · Qty ${it.qty}` : ""}
                      </div>
                    </div>
                    <div className="hco-item__price">₹ {formatInr(it.lineTotal)}</div>
                  </div>
                </section>
              ))}

              <section className="hco-block">
                <div className="hco-label">
                  Phone number
                  {labOverview?.userPhone ? ` : +91 ${labOverview.userPhone}` : " : +91 —"}
                </div>
                <div className="hco-help">Booking related updates will be sent on this number</div>
              </section>

              <section className="hco-block">
                <div className="hco-label">Alternate Phone number</div>
                <div className="hco-alt">
                  <span className="hco-alt__cc">+91</span>
                  <input
                    className="hco-alt__input"
                    placeholder="Enter your alternate number here"
                    value={altPhone}
                    onChange={(e) => setAltPhone(e.target.value)}
                  />
                </div>
              </section>

              <section className="hco-block">
                <div className="hco-label">Date and time</div>
                <div className="hco-dt">
                  <span className="hco-dt__value">{dateTimeDisplay}</span>
                </div>
              </section>

              <section className="hco-lab-vendor" aria-label="Price breakdown">
                <div className="hco-lab-vendor__head">
                  <span className="hco-lab-vendor__logo">
                    {isLabTests
                      ? labOverview?.vendorName || vendorDisplayName || "Lab"
                      : labOverview?.vendorName || "Diagnostics"}
                  </span>
                  <span className="hco-lab-vendor__rating" aria-hidden="true">
                    ★ 4.5
                  </span>
                </div>
                <div className="hco-lab-vendor__lines">
                  {(labOverview?.items ?? []).map((it, idx) => (
                    <div key={`${it.name}-v-${String(idx)}`} className="hco-lab-vendor__line">
                      <span className="hco-lab-vendor__name">{it.name}</span>
                      <span className="hco-lab-vendor__price">₹ {formatInr(it.lineTotal)}</span>
                    </div>
                  ))}
                  <div className="hco-lab-vendor__line hco-lab-vendor__line--charge">
                    <span>Home Collection Charges</span>
                    <span className="hco-lab-vendor__price hco-lab-vendor__price--orange">
                      ₹ {formatInr(labOverview?.collectionCharges ?? 0)}
                    </span>
                  </div>
                </div>
                <div className="hco-lab-vendor__card-total">
                  ₹ {formatInr(labOverview?.netAmount ?? 0)}
                </div>
              </section>

              <section className="hco-totals hco-totals--lab">
                <div className="hco-totals__row">
                  <span className="hco-totals__k">Total MRP</span>
                  <span className="hco-totals__v">₹ {formatInr(labOverview?.totalGross ?? 0)}</span>
                </div>
                <div className="hco-wallet hco-wallet--lab">
                  <div className="hco-wallet__left">
                    <div className="hco-wallet__k">From Wallet</div>
                    <div className="hco-wallet__sub">
                      Wallet limit
                      {labOverview?.walletModuleAvailable != null
                        ? `: ₹ ${formatInr(labOverview.walletModuleAvailable)}`
                        : ""}
                    </div>
                  </div>
                  <div className="hco-wallet__v">
                    ₹ {formatInr(labOverview?.walletPaid ?? labOverview?.netAmount ?? 0)}
                  </div>
                </div>
                <div className="hco-net hco-net--lab">
                  <span className="hco-net__k">Net Pay</span>
                  <span className="hco-net__v">₹ {formatInr(labOverview?.amountToPay ?? 0)}</span>
                </div>
              </section>

              <section className="hco-coins hco-coins--lab" aria-label="Rewards">
                <span className="hco-coins__text">Flip Coins to be earned (1%):</span>
                <span className="hco-coins__pill hco-coins__pill--lab">
                  <span className="hco-coins__coin hco-coins__coin--gold" aria-hidden="true">
                    ●
                  </span>
                  <span>—</span>
                  <span className="hco-coins__worth"> </span>
                </span>
              </section>

              <p className="hco-coins__note">
                Note : Flip Coins will be credited after order completion
              </p>

              <div className="hco-remarks">
                <div className="hco-remarks__k">Remarks :</div>
                <div className="hco-remarks__v">Order cannot be cancelled once confirmed</div>
              </div>
            </div>

            <footer className="hco-paybar">
              <button
                type="button"
                className="hco-paybar__btn hco-paybar__btn--lab"
                disabled={labSubmitting || labOverviewLoading || !labOverview}
                onClick={() => {
                  void (isLabTests ? onLabConfirm() : onHealthConfirm());
                }}
              >
                <span className="hco-paybar__lab-label">
                  {labSubmitting ? "Confirming…" : "Confirm and pay"}
                </span>
              </button>
            </footer>
        </div>
      </main>
    </div>
  );
}
