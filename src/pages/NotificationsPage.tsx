import {
  clearAllPatientNotifications,
  deletePatientNotificationById,
  fetchPatientNotifications,
  markPatientNotificationsRead,
  type PatientNotificationRow,
} from "@/api/patientNotifications";
import { useAppConfirm } from "@/components/dialog/AppConfirmDialog";
import { HomeBottomNav } from "@/components/navigation/HomeBottomNav";
import { ROUTES } from "@/constants";
import { useToast } from "@/hooks/useToast";
import { invoiceIdFromNotificationDetails } from "@/lib/notificationOrderLink";
import { useCallback, useEffect, useRef, useState } from "react";
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

function TrashIcon() {
  return (
    <svg className="notif-row__trash-ic" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.75"
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
  const appConfirm = useAppConfirm();
  const [items, setItems] = useState<readonly PatientNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [deletingIds, setDeletingIds] = useState<ReadonlySet<string>>(new Set());
  const deletingIdsRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPatientNotifications();
      setItems(list);
      void markPatientNotificationsRead();
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

  const onClearAll = useCallback(async () => {
    if (clearingAll || items.length === 0) return;
    const ok = await appConfirm({
      title: "Clear all notifications?",
      message: "This will permanently delete all notifications.",
      variant: "destructive",
      confirmLabel: "Clear all",
      cancelLabel: "Cancel",
    });
    if (!ok) return;
    setClearingAll(true);
    try {
      await clearAllPatientNotifications();
      setItems([]);
      toast.success("All notifications cleared.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear notifications");
    } finally {
      setClearingAll(false);
    }
  }, [appConfirm, clearingAll, items.length, toast]);

  const onDeleteOne = useCallback(async (row: PatientNotificationRow) => {
    const id = row.id.trim();
    if (!id || deletingIdsRef.current.has(id)) return;
    const ok = await appConfirm({
      title: "Delete notification?",
      message: "This notification will be removed permanently.",
      variant: "destructive",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!ok) return;
    deletingIdsRef.current.add(id);
    setDeletingIds(new Set(deletingIdsRef.current));
    try {
      await deletePatientNotificationById(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success("Notification removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete notification");
    } finally {
      deletingIdsRef.current.delete(id);
      setDeletingIds(new Set(deletingIdsRef.current));
    }
  }, [appConfirm, toast]);

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
        {!loading && !error && items.length > 0 ? (
          <button
            type="button"
            className="notif-page__clear-all"
            onClick={() => void onClearAll()}
            disabled={clearingAll}
          >
            {clearingAll ? "Clearing…" : "Clear all"}
          </button>
        ) : (
          <span className="notif-page__header-spacer" aria-hidden />
        )}
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
              const rowDeleting = deletingIds.has(row.id);
              return (
                <li key={row.id} className="notif-list__item">
                  <div
                    className={`notif-card${hasOrder ? " notif-card--actionable" : ""}`}
                  >
                    <button
                      type="button"
                      className="notif-row__delete"
                      aria-label={`Delete notification: ${row.title}`}
                      title="Delete"
                      disabled={rowDeleting || clearingAll}
                      onClick={(e) => {
                        e.stopPropagation();
                        void onDeleteOne(row);
                      }}
                    >
                      {rowDeleting ? (
                        <span className="notif-row__delete-busy" aria-hidden>
                          …
                        </span>
                      ) : (
                        <TrashIcon />
                      )}
                    </button>
                    <button
                      type="button"
                      className="notif-row"
                      onClick={() => onRowActivate(row)}
                      disabled={rowDeleting}
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
                  </div>
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
