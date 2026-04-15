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
import { confirmDiagnosticsOrder } from "@/api/patientDiagnosticsOrderConfirm";
import {
  normalizeBookingOverviewPayload,
  parseBookingInvoiceId,
  postDiagnosticsBooking,
  type DiagnosticSlotPick,
  type DiagnosticsBookingBody,
  type NormalizedBookingOverview,
} from "@/api/patientDiagnosticsLab";
import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
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

  const addedItemsCount = isLabTests
    ? Math.max(1, labOverview?.items.length ?? 1)
    : 1;

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
    try {
      const raw = await postDiagnosticsBooking(false, body, false);
      const invoiceId = parseBookingInvoiceId(raw);
      const pay = labOverview?.amountToPay ?? null;
      if (pay != null && pay > 0) {
        toast.error("Payment is required for this booking. Complete payment in the main app.");
        return;
      }
      if (invoiceId) {
        await confirmDiagnosticsOrder({ src: "self", order_id: invoiceId });
      }
      navigate(generatePath(ROUTES.diagnosticsBookingSuccess, { type }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setLabSubmitting(false);
    }
  };

  return (
    <div className={`hco-page${isLabTests ? " hco-page--lab" : ""}`}>
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
        <h1 className="hco-title">{isLabTests ? "Cart Overview" : "Health Checkups"}</h1>
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
        {isLabTests ? (
          <>
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
                        {vendorDisplayName || vendorId || "Lab partner"}
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
                    {labOverview?.vendorName || vendorDisplayName || "Lab"}
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
                onClick={() => void onLabConfirm()}
              >
                <span className="hco-paybar__lab-label">
                  {labSubmitting ? "Confirming…" : "Confirm and pay"}
                </span>
              </button>
            </footer>
          </>
        ) : (
          <>
            <div className="hco-main__content">
              <div className="hco-subhead">
                <span className="hco-subhead__title">Added Items({addedItemsCount})</span>
              </div>

              <section className="hco-item">
                <div className="hco-item__row">
                  <div className="hco-item__text">
                    <div className="hco-item__name">Employee Annual Health Checkup</div>
                    <div className="hco-item__meta">{vendorId ? `Vendor: ${vendorId}` : "For Kalyan"}</div>
                  </div>
                  <div className="hco-item__price">₹ 4,000</div>
                </div>
              </section>

              <section className="hco-block">
                <div className="hco-label">Phone number : +91 73********</div>
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
                  <span className="hco-dt__value">{slotLabel || "April 10, 2024 | 2PM–3PM"}</span>
                  <button type="button" className="hco-dt__edit" aria-label="Edit date and time">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L16.5 4.5a2.1 2.1 0 0 0-3 0L3 15v5z"
                        stroke="#1A73E8"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </section>

              <section className="hco-totals">
                <div className="hco-totals__row">
                  <span className="hco-totals__k">Total MRP</span>
                  <span className="hco-totals__v">₹ 4,000</span>
                </div>
                <div className="hco-totals__row hco-totals__muted">
                  <span className="hco-totals__k">Home Collection Charges</span>
                  <span className="hco-totals__v">₹ 80</span>
                </div>

                <div className="hco-wallet">
                  <div className="hco-wallet__left">
                    <div className="hco-wallet__k">From Wallet</div>
                    <div className="hco-wallet__sub">Wallet Limit : ₹ 4,600</div>
                  </div>
                  <div className="hco-wallet__v">₹ 4,000</div>
                </div>

                <div className="hco-net">
                  <span className="hco-net__k">Net Pay</span>
                  <span className="hco-net__v">
                    <span className="hco-net__strike">₹ 4,080</span> ₹ 0
                  </span>
                </div>
              </section>

              <section className="hco-item">
                <div className="hco-item__row">
                  <div className="hco-item__text">
                    <div className="hco-item__name">Employee Annual Health Checkup</div>
                    <div className="hco-item__meta">{vendorId ? `Vendor: ${vendorId}` : "For Kalyan"}</div>
                  </div>
                  <div className="hco-item__price">₹ 4,000</div>
                </div>
              </section>

              <section className="hco-block">
                <div className="hco-label">
                  <span>Phone number : +91 9999999999</span>
                </div>
                <div className="hco-help">
                  <span>Booking related updates will be sent on this number</span>
                </div>
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
                  <button type="button" className="hco-dt__edit" aria-label="Edit date and time">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L16.5 4.5a2.1 2.1 0 0 0-3 0L3 15v5z"
                        stroke="#1A73E8"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </section>

              <section className="hco-totals">
                <div className="hco-totals__row">
                  <span className="hco-totals__k">Total MRP</span>
                  <span className="hco-totals__v">₹ 4,000</span>
                </div>
                <div className="hco-totals__row hco-totals__muted">
                  <span className="hco-totals__k">Home Collection Charges</span>
                  <span className="hco-totals__v">₹ 80</span>
                </div>

                <div className="hco-wallet">
                  <div className="hco-wallet__left">
                    <div className="hco-wallet__k">From Wallet</div>
                    <div className="hco-wallet__sub">Wallet Limit : ₹ 4,600</div>
                  </div>
                  <div className="hco-wallet__v">₹ 4,000</div>
                </div>

                <div className="hco-net">
                  <span className="hco-net__k">Net Pay</span>
                  <span className="hco-net__v">
                    <span className="hco-net__strike">₹ 4,080</span> ₹ 0
                  </span>
                </div>
              </section>

              <section className="hco-coins">
                <span className="hco-coins__text">Flip Coins to be earned (1%):</span>
                <span className="hco-coins__pill">
                  <span className="hco-coins__coin" aria-hidden="true">
                    ₹
                  </span>
                  <span>400</span>
                  <span className="hco-coins__worth">Worth ₹ 40</span>
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
                className="hco-paybar__btn"
                onClick={() => navigate(generatePath(ROUTES.diagnosticsBookingSuccess, { type }))}
              >
                <span className="hco-paybar__amt">₹ 0</span>
                <span className="hco-paybar__label">Confirm and pay</span>
              </button>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
