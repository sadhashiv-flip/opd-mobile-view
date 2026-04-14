import { fetchPatientNotifications, type PatientNotificationRow } from "@/api/patientNotifications";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import { invoiceIdFromNotificationDetails } from "@/lib/notificationOrderLink";
import { useCallback, useEffect, useState } from "react";
import { generatePath, useNavigate } from "react-router-dom";
import "./NotificationsPage.css";

function ChevronRight() {
  return (
    <svg className="notif-row__chev" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatNotifTime(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(t);
  } catch {
    return null;
  }
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<readonly PatientNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPatientNotifications();
      setItems(list);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "Could not load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRowActivate = (row: PatientNotificationRow) => {
    const invoiceId = invoiceIdFromNotificationDetails(row.details);
    if (invoiceId) {
      navigate(generatePath(ROUTES.ordersDetailLegacy, { invoiceId }));
      return;
    }
    toast.show("No order details are linked to this notification.", { variant: "info" });
  };

  return (
    <div className="notif-page">
      <header className="notif-page__top">
        <button
          type="button"
          className="notif-page__back"
          aria-label="Back to home"
          onClick={() => navigate(ROUTES.dashboard)}
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
        </button>
        <h1 className="notif-page__title">Notifications</h1>
      </header>

      <main className="notif-page__main">
        {loading ? (
          <div className="notif-skeleton" aria-busy="true">
            {[0, 1, 2].map((k) => (
              <div key={k} className="notif-skeleton__row" />
            ))}
          </div>
        ) : null}

        {!loading && error ? (
          <div className="notif-state notif-state--error">
            <p>{error}</p>
            <button type="button" className="notif-retry" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <p className="notif-state notif-state--empty">You have no notifications yet.</p>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <ul className="notif-list">
            {items.map((row) => {
              const hasOrder = invoiceIdFromNotificationDetails(row.details) != null;
              const timeLabel = formatNotifTime(row.createdAt);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`notif-row${hasOrder ? " notif-row--actionable" : ""}`}
                    onClick={() => onRowActivate(row)}
                  >
                    <div className="notif-row__text">
                      <span className="notif-row__title">{row.title}</span>
                      {row.body ? <p className="notif-row__body">{row.body}</p> : null}
                      {timeLabel ? (
                        <span className="notif-row__time" aria-label={`Sent ${timeLabel}`}>
                          {timeLabel}
                        </span>
                      ) : null}
                    </div>
                    {hasOrder ? <ChevronRight /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </main>

      <HomeBottomNav />
    </div>
  );
}
