import { Link, generatePath, useParams } from "react-router-dom";
import { ROUTES } from "@/constants";
import { useMemo } from "react";
import "./ConsultationAppointmentOverviewPage.css";

const STORAGE_PREFIX = "opd-mobile-view.virtualSlots.";

type VirtualSpecialtySlotsState = Readonly<{
  parent: number;
  issueTitle: string;
  spid: number;
}>;

function readStoredMeta(issueId: string): VirtualSpecialtySlotsState | null {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${issueId}`);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<VirtualSpecialtySlotsState>;
    if (
      typeof p.parent === "number" &&
      Number.isFinite(p.parent) &&
      typeof p.spid === "number" &&
      Number.isFinite(p.spid) &&
      typeof p.issueTitle === "string"
    ) {
      return { parent: p.parent, spid: p.spid, issueTitle: p.issueTitle };
    }
  } catch {
    // ignore
  }
  return null;
}

export function ConsultationVirtualAppointmentOverviewPage() {
  const params = useParams();
  const issueId = typeof params.issueId === "string" ? params.issueId : "";

  const issueTitle = useMemo(() => readStoredMeta(issueId)?.issueTitle ?? "Appointment Overview", [issueId]);

  const slotDate = useMemo(() => {
    try {
      return sessionStorage.getItem("opd-mobile-view.virtualBooking.slotDate") ?? "";
    } catch {
      return "";
    }
  }, []);

  const slotKey = useMemo(() => {
    try {
      return sessionStorage.getItem("opd-mobile-view.virtualBooking.selectedSlotKey") ?? "";
    } catch {
      return "";
    }
  }, []);

  const timeLabel = useMemo(() => {
    if (!slotKey) return "";
    const parts = slotKey.split("|");
    return parts.length >= 2 ? parts.slice(1).join("|") : "";
  }, [slotKey]);

  return (
    <div className="cao-page">
      <header className="cao-top">
        <Link
          to={generatePath(ROUTES.consultationVirtualSlots, { issueId })}
          className="cao-back"
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
        </Link>
        <h1 className="cao-title">Appointment Overview</h1>
      </header>

      <main className="cao-main">
        <section className="cao-doc">
          <div className="cao-doc__top">
            <div className="cao-doc__avatar" aria-hidden="true" />
            <div className="cao-doc__meta">
              <div className="cao-doc__name">{issueTitle}</div>
              <div className="cao-doc__sub">Virtual consultation</div>
            </div>
            <div className="cao-chip">Cashless Available</div>
          </div>
        </section>

        <section className="cao-fees">
          <div className="cao-fees__row">
            <span>Doctor&apos;s Fee</span>
            <strong>₹ 0</strong>
          </div>
          <div className="cao-fees__row cao-fees__row--total">
            <span>Total Amount</span>
            <strong>₹ 0</strong>
          </div>
        </section>

        <section className="cao-field">
          <div className="cao-field__label">Date and time</div>
          <div className="cao-field__row">
            <div className="cao-field__value">
              {slotDate || "—"} {timeLabel ? `| ${timeLabel}` : ""}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

