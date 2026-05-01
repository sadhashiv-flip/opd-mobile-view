import { ROUTES } from "@/constants";
import myOrdersSvg from "@/assets/icons/common/MyOrders.svg";
import { AddressBottomSheet } from "@/components/address/AddressBottomSheet";
import { DIAG_LAB_SLOT_PAYLOAD_KEY } from "@/constants/diagnosticsLabFlowStorage";
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
  type DiagnosticsOverviewLineItem,
  type NormalizedBookingOverview,
} from "@/api/patientDiagnosticsLab";
import { resolveProfileImageUrl } from "@/api/patientProfile";
import { buildDiagnosticsBookingSuccessState } from "@/lib/buildDiagnosticsBookingSuccessState";
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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import "./HealthCheckupsOverviewPage.css";

const LAB_OVERVIEW_ADDRESS =
  "iSprout, 7th floor, Plot No: 28, Divyasree Trinity, near Hexagon Capability Center, 5 & 6, Hitech City, Hyderabad, Telangana 500081";

function formatInr(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function capitalizeWord(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  if (!t) return "";
  return `${t[0].toUpperCase()}${t.slice(1).toLowerCase()}`;
}

type LabItemGroup = Readonly<{
  userKey: number;
  userName: string | null;
  userGender: string | null;
  items: readonly DiagnosticsOverviewLineItem[];
}>;

/** Same bucket order as Flutter `_groupItemsByUser` — first occurrence defines group order. */
function groupLabOverviewItems(items: readonly DiagnosticsOverviewLineItem[]): LabItemGroup[] {
  const order: number[] = [];
  const map = new Map<number, DiagnosticsOverviewLineItem[]>();
  for (const it of items) {
    const id = it.userId ?? -1;
    if (!map.has(id)) {
      order.push(id);
      map.set(id, []);
    }
    map.get(id)!.push(it);
  }
  return order.map((id) => {
    const list = map.get(id)!;
    const head = list[0];
    return {
      userKey: id,
      userName: head?.userName ?? null,
      userGender: head?.userGender ?? null,
      items: list,
    };
  });
}

function distinctLabItemUsers(items: readonly DiagnosticsOverviewLineItem[]) {
  const seen = new Set<number>();
  const out: { id: number; name: string; gender: string | null }[] = [];
  for (const it of items) {
    if (it.userId == null) continue;
    if (seen.has(it.userId)) continue;
    seen.add(it.userId);
    out.push({
      id: it.userId,
      name: it.userName?.trim() || "Member",
      gender: it.userGender,
    });
  }
  return out;
}

function LtCard(props: Readonly<{
  icon: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
}>) {
  return (
    <section className="lt-card">
      <div className="lt-card__head">
        <div className="lt-card__icon" aria-hidden>
          {props.icon}
        </div>
        <div className="lt-card__titles">
          <h2 className="lt-card__title">{props.title}</h2>
          {props.subtitle ? <p className="lt-card__subtitle">{props.subtitle}</p> : null}
        </div>
      </div>
      <div className="lt-card__body">{props.children}</div>
    </section>
  );
}

function LabVendorLogo(props: Readonly<{ name: string | null; logoPath: string | null }>) {
  const url = resolveProfileImageUrl(props.logoPath);
  const initial = (props.name?.trim()?.[0] ?? "V").toUpperCase();
  if (url) {
    return (
      <span className="lt-vlogo">
        <img src={url} alt="" className="lt-vlogo__img" width={32} height={32} loading="lazy" />
      </span>
    );
  }
  return (
    <span className="lt-vlogo lt-vlogo--fallback" aria-hidden>
      {initial}
    </span>
  );
}

function labConfirmPrimaryLabel(o: NormalizedBookingOverview): string {
  if (o.amountToPay <= 0) return "Confirm booking";
  return `Pay ₹${formatInr(o.amountToPay)}`;
}

function LtPricingSummary(props: Readonly<{ overview: NormalizedBookingOverview }>) {
  const { overview } = props;
  const saved = overview.pricingSaved;
  const opdAvail = overview.walletAvailable;
  const opdPaid = overview.walletPaid;
  const showWalletBlock = opdAvail != null || opdPaid != null;
  return (
    <div className="lt-pr">
      <div className="lt-pr__row">
        <span>Subtotal</span>
        <span>₹{formatInr(overview.totalGross)}</span>
      </div>
      {saved > 0 ? (
        <div className="lt-pr__row lt-pr__row--good">
          <span>Discount</span>
          <span>− ₹{formatInr(saved)}</span>
        </div>
      ) : null}
      {overview.collectionCharges > 0 ? (
        <div className="lt-pr__row">
          <span>Collection</span>
          <span>₹{formatInr(overview.collectionCharges)}</span>
        </div>
      ) : null}
      <div className="lt-pr__rule" />
      <div className="lt-pr__row lt-pr__row--bold">
        <span>Net amount</span>
        <span>₹{formatInr(overview.netAmount)}</span>
      </div>
      {showWalletBlock ? (
        <div className="lt-pr__wallet">
          <div className="lt-pr__wallet-title">Flip wallet (OPD)</div>
          {opdAvail != null ? (
            <div className="lt-pr__row lt-pr__row--good">
              <span>Available balance</span>
              <span>₹{formatInr(opdAvail)}</span>
            </div>
          ) : null}
          {opdPaid != null ? (
            <div className="lt-pr__row">
              <span>Paid from wallet</span>
              <span>₹{formatInr(opdPaid)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      {overview.amountToPay <= 0 ? (
        <div className="lt-pr__zero">
          <span aria-hidden>✓</span>
          <span>Covered by wallet — no payment needed</span>
        </div>
      ) : (
        <div className="lt-pr__row lt-pr__row--pay">
          <span>Pay from pocket</span>
          <span>₹{formatInr(overview.amountToPay)}</span>
        </div>
      )}
    </div>
  );
}

const LT_IC_PERSON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);
const LT_IC_PIN = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 21s7-4.35 7-11a7 7 0 10-14 0c0 6.65 7 11 7 11z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="12" cy="10" r="2.5" fill="currentColor" />
  </svg>
);
const LT_IC_PHONE = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);
const LT_IC_CLOCK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const LT_IC_FLASK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M10 2v5.2c0 .28-.06.56-.17.82L6.5 14.5a4 4 0 003.35 6h4.3a4 4 0 003.35-6l-3.33-6.48a1 1 0 01-.17-.82V2M8 2h8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);
const LT_IC_PAY = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M2 10h20" stroke="currentColor" strokeWidth="2" />
  </svg>
);

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
  const [labPaySheetOpen, setLabPaySheetOpen] = useState(false);
  const [useLabWallet, setUseLabWallet] = useState(false);

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
    if (labOverview) setUseLabWallet(false);
  }, [labOverview]);

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
  /** Confirmed booking invoice id for success screen (Razorpay or zero-pay confirm). */
  const pendingDiagnosticsInvoiceRef = useRef<string | null>(null);
  const diagRzpSuccessRef = useRef<() => void>(() => {});
  const diagRzpErrorRef = useRef<(message: string) => void>(() => {});

  useDiagnosticsRazorpayConfirm({
    invoiceIdRef: diagRzpInvoiceIdRef,
    onSuccessRef: diagRzpSuccessRef,
    onErrorRef: diagRzpErrorRef,
  });

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
        pendingDiagnosticsInvoiceRef.current = invoiceId;
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
      pendingDiagnosticsInvoiceRef.current = invoiceId;
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
      return `${formattedScheduleDate} • ${slotLabel}`;
    }
    return `${formattedScheduleDate} • 2PM-3PM`;
  }, [slotLabel, formattedScheduleDate]);

  const successScheduleDisplay = useMemo(() => {
    if (isLabTests && labOverview) {
      const d = labOverview.formattedSlotDate;
      const t = labOverview.formattedSlotTimeRange;
      if (d && t) return `${d} • ${t}`;
      if (d) return t ? `${d} • ${t}` : d;
    }
    return dateTimeDisplay;
  }, [isLabTests, labOverview, dateTimeDisplay]);

  const labItemGroups = useMemo(
    () => (labOverview?.items.length ? groupLabOverviewItems(labOverview.items) : []),
    [labOverview?.items],
  );

  const labDistinctUsers = useMemo(
    () => (labOverview?.items.length ? distinctLabItemUsers(labOverview.items) : []),
    [labOverview?.items],
  );

  diagRzpSuccessRef.current = () => {
    setLabSubmitting(false);
    toast.success("Booking confirmed");
    const inv =
      pendingDiagnosticsInvoiceRef.current?.trim() ||
      diagRzpInvoiceIdRef.current?.trim() ||
      "";
    const addrLine = labOverview?.addressLine?.trim() || locAddrLine.trim();
    navigate(generatePath(ROUTES.diagnosticsBookingSuccess, { type }), {
      replace: true,
      state: buildDiagnosticsBookingSuccessState({
        invoiceId: inv,
        overview: labOverview,
        scheduleDisplay: successScheduleDisplay,
        locationTag: labOverview?.addressTag?.trim() || "Home",
        addressLine: addrLine,
      }),
    });
  };

  const addedItemsCount = Math.max(1, labOverview?.items.length ?? 1);

  const runLabPlaceOrder = async (wallet: boolean) => {
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
      const raw = await postDiagnosticsBooking(false, body, wallet);
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

  const showLabUserHeaders =
    labItemGroups.length > 1 ||
    labItemGroups.some((g) => g.userKey >= 0 && (g.userName ?? "").trim().length > 0);

  return (
    <div className={`hco-page ${isLabTests ? "hco-page--lab-review" : "hco-page--lab"}`}>
      <header className="hco-top">
        <Link
          to={isLabTests ? ROUTES.orders : generatePath(ROUTES.diagnosticsSlots, { type })}
          replace={isLabTests}
          className="hco-back"
          aria-label={isLabTests ? "Back to orders" : "Back to slots"}
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
        <h1 className="hco-title">{isLabTests ? "Review Booking" : "Booking summary"}</h1>
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

      {!isLabTests ? (
        <button
          type="button"
          className="hco-loc"
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
      ) : null}

      <AddressBottomSheet open={addrSheetOpen} onClose={() => setAddrSheetOpen(false)} />

      <main className={`hco-main ${isLabTests ? "hco-main--lab-review" : ""}`}>
        {isLabTests ? (
          <>
            {labOverviewLoading ? (
              <div className="lt-overview lt-overview--loading">
                <output className="lt-overview__spinner" aria-live="polite">
                  Loading…
                </output>
              </div>
            ) : null}
            {!labOverviewLoading && labOverviewError && !labOverview ? (
              <div className="lt-overview lt-overview--error">
                <p className="lt-overview__err" role="alert">
                  {labOverviewError}
                </p>
                <button type="button" className="lt-overview__retry" onClick={() => void loadLabOverview()}>
                  Retry
                </button>
              </div>
            ) : null}
            {!labOverviewLoading && labOverview ? (
              <div className="lt-overview">
                <LtCard icon={LT_IC_PERSON} title="Contact & users">
                  {labDistinctUsers.length > 1 ? (
                    <>
                      <p className="lt-muted">Users included in this booking:</p>
                      <div className="lt-chip-row">
                        {labDistinctUsers.map((u) => (
                          <span key={u.id} className="lt-chip">
                            <span className="lt-chip__name">{u.name}</span>
                            {u.gender ? (
                              <span className="lt-chip__gender">{capitalizeWord(u.gender)}</span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : null}
                  {labDistinctUsers.length === 1 ? (
                    <div className="lt-contact-name-row">
                      <span className="lt-contact-name">{labDistinctUsers[0]?.name}</span>
                      {labDistinctUsers[0]?.gender ? (
                        <span className="lt-pill">{capitalizeWord(labDistinctUsers[0]?.gender)}</span>
                      ) : null}
                    </div>
                  ) : null}
                  {labDistinctUsers.length === 0 && labOverview.userName.trim() ? (
                    <div className="lt-contact-name">{labOverview.userName.trim()}</div>
                  ) : null}
                  <div className="lt-phone-block">
                    <div className="lt-muted lt-muted--semi">Phone number</div>
                    <div className="lt-phone-val">
                      {labOverview.userPhone.trim() ? `+91 ${labOverview.userPhone}` : "—"}
                    </div>
                    <div className="lt-muted lt-muted--fine">
                      Booking related updates will be sent on this number
                    </div>
                  </div>
                  {labOverview.userEmail?.trim() ? (
                    <div className="lt-email">{labOverview.userEmail.trim()}</div>
                  ) : null}
                </LtCard>

                {labOverview.addressLine.trim() ? (
                  <LtCard icon={LT_IC_PIN} title="Collection Address">
                    <div className="lt-addr-head">
                      {labOverview.addressTag ? (
                        <span className="lt-addr-tag">{labOverview.addressTag}</span>
                      ) : (
                        <span className="lt-addr-tag">Home</span>
                      )}
                      <button
                        type="button"
                        className="lt-addr-change"
                        onClick={() => setAddrSheetOpen(true)}
                      >
                        Change
                      </button>
                    </div>
                    <p className="lt-addr-lines">{labOverview.addressLine.trim()}</p>
                  </LtCard>
                ) : null}

                <LtCard icon={LT_IC_PHONE} title="Alternative Phone (Optional)">
                  <div className="hco-alt lt-alt">
                    <span className="hco-alt__cc">+91</span>
                    <input
                      className="hco-alt__input"
                      placeholder="10-digit mobile number"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={10}
                      value={altPhone}
                      onChange={(e) => setAltPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    />
                  </div>
                </LtCard>

                <LtCard icon={LT_IC_CLOCK} title="Appointment">
                  <div className="lt-appt">
                    <div className="lt-appt__primary">
                      {labOverview.formattedSlotDate ?? formattedScheduleDate}
                    </div>
                    <div className="lt-appt__secondary">
                      {labOverview.formattedSlotTimeRange ?? slotLabel ?? "—"}
                    </div>
                  </div>
                </LtCard>

                <LtCard
                  icon={LT_IC_FLASK}
                  title={`Tests & amounts (${labOverview.items.length})`}
                  subtitle="Grouped by user. Each block lists that user's tests and a subtotal; the Payment card shows the full order total."
                >
                  <div className="lt-groups">
                    {labItemGroups.map((group, gi) => {
                      const subtotal = group.items.reduce((a, x) => a + x.lineTotal, 0);
                      return (
                        <div key={`${String(group.userKey)}-${String(gi)}`} className="lt-user-bucket">
                          {showLabUserHeaders ? (
                            <>
                              {group.userKey >= 0 && group.userName?.trim() ? (
                                <div className="lt-user-bucket__user">
                                  <span className="lt-user-bucket__k">User</span>
                                  <div className="lt-user-bucket__name-row">
                                    <span className="lt-user-bucket__name">{group.userName.trim()}</span>
                                    {group.userGender?.trim() ? (
                                      <span className="lt-pill">{capitalizeWord(group.userGender)}</span>
                                    ) : null}
                                  </div>
                                </div>
                              ) : (
                                <div className="lt-user-bucket__fallback">
                                  Tests (user not specified on item)
                                </div>
                              )}
                              <div className="lt-user-bucket__rule" />
                            </>
                          ) : null}
                          <div className="lt-user-bucket__lines">
                            {group.items.map((it, ii) => (
                              <div key={`${it.name}-${String(ii)}`} className="lt-test-line">
                                <div className="lt-test-line__main">
                                  <LabVendorLogo name={it.vendorName} logoPath={it.vendorLogo} />
                                  <div className="lt-test-line__mid">
                                    <div className="lt-test-line__name">{it.name}</div>
                                    {(it.category || it.vendorName) ? (
                                      <div className="lt-test-line__meta">
                                        {[it.category, it.vendorName].filter(Boolean).join(" · ")}
                                      </div>
                                    ) : null}
                                    {it.free ? <span className="lt-badge-free">FREE</span> : null}
                                    {!it.free && it.savedLine > 0 ? (
                                      <div className="lt-saved">Saved ₹{formatInr(it.savedLine)}</div>
                                    ) : null}
                                  </div>
                                  <div className="lt-test-line__price">₹{formatInr(it.lineTotal)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="lt-subtotal">
                            <span className="lt-subtotal__k">
                              {group.userKey >= 0 && group.userName?.trim()
                                ? `Subtotal for ${group.userName.trim()}`
                                : "Subtotal for these tests"}
                            </span>
                            <span className="lt-subtotal__v">₹{formatInr(subtotal)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </LtCard>

                <LtCard icon={LT_IC_PAY} title="Payment">
                  <LtPricingSummary overview={labOverview} />
                </LtCard>
              </div>
            ) : null}

            {!labOverviewLoading && labOverview ? (
              <footer className="lt-footer">
                <button
                  type="button"
                  className="lt-footer__btn"
                  disabled={labSubmitting || labOverviewLoading || !labOverview}
                  onClick={() => setLabPaySheetOpen(true)}
                >
                  {labSubmitting ? "Confirming…" : "Continue"}
                </button>
              </footer>
            ) : null}
          </>
        ) : (
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
                        {labOverview?.vendorName || vendorId || "Diagnostics partner"}
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
                    {labOverview?.vendorName || "Diagnostics"}
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
                onClick={() => void onHealthConfirm()}
              >
                <span className="hco-paybar__lab-label">
                  {labSubmitting ? "Confirming…" : "Confirm and pay"}
                </span>
              </button>
            </footer>
          </div>
        )}
      </main>

      {isLabTests && labPaySheetOpen && labOverview ? (
        <div
          className="lt-sheet-backdrop"
          role="presentation"
          onClick={() => !labSubmitting && setLabPaySheetOpen(false)}
        >
          <div
            className="lt-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lt-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lt-sheet__head">
              <h2 id="lt-sheet-title" className="lt-sheet__title">
                Confirm booking
              </h2>
              <button
                type="button"
                className="lt-sheet__close"
                aria-label="Close"
                disabled={labSubmitting}
                onClick={() => setLabPaySheetOpen(false)}
              >
                ×
              </button>
            </div>
            <LtPricingSummary overview={labOverview} />
            {labOverview.amountToPay > 0 ? (
              <label className="lt-sheet__wallet">
                <span>Use Flip wallet (OPD)</span>
                <input
                  type="checkbox"
                  className="lt-sheet__switch"
                  checked={useLabWallet}
                  onChange={(e) => setUseLabWallet(e.target.checked)}
                />
              </label>
            ) : null}
            <button
              type="button"
              className="lt-sheet__cta"
              disabled={labSubmitting}
              onClick={() => {
                setLabPaySheetOpen(false);
                void runLabPlaceOrder(useLabWallet);
              }}
            >
              {labSubmitting ? "Confirming…" : labConfirmPrimaryLabel(labOverview)}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
