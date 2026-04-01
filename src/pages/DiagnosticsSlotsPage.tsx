import { ROUTES } from "@/constants";
import { Link, generatePath, useNavigate, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import "./DiagnosticsSlotsPage.css";

export function DiagnosticsSlotsPage() {
  const navigate = useNavigate();
  const params = useParams();
  const type = typeof params.type === "string" ? params.type : "health-checkups";
  const vendorId = useMemo(() => {
    try {
      return localStorage.getItem("opd-mobile-view.diagnostics.vendorId") ?? "";
    } catch {
      return "";
    }
  }, []);

  const slots = useMemo(
    () => [
      { id: "s1", label: "09:00 AM - 10:00 AM" },
      { id: "s2", label: "10:00 AM - 11:00 AM" },
      { id: "s3", label: "11:00 AM - 12:00 PM" },
      { id: "s4", label: "12:00 PM - 01:00 PM" },
    ],
    [],
  );

  const [selectedSlotId, setSelectedSlotId] = useState<string>(slots[0].id);

  return (
    <div className="dslot-page">
      <header className="dslot-top">
        <Link
          to={generatePath(ROUTES.diagnosticsVendors, { type })}
          className="dslot-back"
          aria-label="Back to vendors"
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
        <h1 className="dslot-title">Slots</h1>
      </header>

      <main className="dslot-main">
        <div className="dslot-vendor">
          Vendor: <span className="dslot-vendor__id">{vendorId || "Selected vendor"}</span>
        </div>

        <h2 className="dslot-sub">Choose slot</h2>
        <div className="dslot-list" role="radiogroup" aria-label="Slots">
          {slots.map((s) => {
            const selected = s.id === selectedSlotId;
            return (
              <button
                key={s.id}
                type="button"
                className={`dslot-item${selected ? " dslot-item--selected" : ""}`}
                role="radio"
                aria-checked={selected}
                onClick={() => setSelectedSlotId(s.id)}
              >
                <span className="dslot-dot" aria-hidden="true" />
                <span className="dslot-label">{s.label}</span>
              </button>
            );
          })}
        </div>
      </main>

      <footer className="dslot-footer">
        <button
          type="button"
          className="dslot-continue"
          onClick={() => {
            const slot = slots.find((s) => s.id === selectedSlotId)?.label ?? "";
            try {
              localStorage.setItem("opd-mobile-view.diagnostics.slotId", selectedSlotId);
              localStorage.setItem("opd-mobile-view.diagnostics.slotLabel", slot);
            } catch {
              // ignore storage errors
            }
            navigate(generatePath(ROUTES.diagnosticsOverview, { type }));
          }}
        >
          Confirm
        </button>
      </footer>
    </div>
  );
}

