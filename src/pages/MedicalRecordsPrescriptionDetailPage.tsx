import { fetchPrescriptionById } from "@/api/patientPrescriptions";
import { fetchConsultationReportPdfObjectUrl } from "@/api/patientConsultationReport";
import {
  AttachmentFilePreview,
  type AttachmentFilePreviewViewer,
} from "@/components/attachments/AttachmentFilePreview";
import { FlowScreenBack } from "@/components/navigation/FlowScreenBack";
import { useToast } from "@/hooks/useToast";
import { ROUTES } from "@/constants";
import {
  medicineDurationText,
  medicineTimings,
  medicineWeeklyText,
  prescriptionChronicMedicines,
  prescriptionCreatedAtDate,
  prescriptionDiagnosis,
  prescriptionDoctorDisplayName,
  prescriptionDoctorExperience,
  prescriptionDoctorRating,
  prescriptionDoctorSpecialty,
  prescriptionIsChronic,
  prescriptionMedicineCount,
  prescriptionNeedsReportLookup,
  prescriptionNotes,
  prescriptionOtherMedicines,
  prescriptionPurpose,
  prescriptionRecommendation,
  prescriptionReportAppointmentId,
  prescriptionStatusLabel,
  prescriptionStatusTone,
  timingChipMeta,
  type PrescriptionMedicineItem,
} from "@/lib/prescriptionRecordRow";
import { generatePath, useLocation, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./MedicalRecordsPrescriptionDetailPage.css";

type LocationState = Readonly<{
  row?: Record<string, unknown>;
  returnPath?: string;
}>;

function InfoCard({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="mr-rx-detail-card">
      <h2 className="mr-rx-detail-card__title">{title}</h2>
      <div className="mr-rx-detail-card__divider" aria-hidden />
      {children}
    </section>
  );
}

function statusBannerIcon(tone: ReturnType<typeof prescriptionStatusTone>): string {
  if (tone === "completed" || tone === "active") return "✓";
  if (tone === "cancelled") return "✕";
  return "ℹ";
}

function StatusBanner({ row }: Readonly<{ row: Record<string, unknown> }>) {
  const label = prescriptionStatusLabel(row);
  const tone = prescriptionStatusTone(label);
  const count = prescriptionMedicineCount(row);
  const chronic = prescriptionIsChronic(row);

  return (
    <div className={`mr-rx-detail-status mr-rx-detail-status--${tone}`}>
      <span className="mr-rx-detail-status__icon" aria-hidden>
        {statusBannerIcon(tone)}
      </span>
      <span className="mr-rx-detail-status__text">
        <span className="mr-rx-detail-status__title">{label}</span>
        <span className="mr-rx-detail-status__sub">
          {count} {count === 1 ? "medicine" : "medicines"} prescribed
        </span>
      </span>
      {chronic ? <span className="mr-rx-detail-status__chronic">Chronic</span> : null}
    </div>
  );
}

function PrescriptionReportSection({
  reportApptId,
  reportLoading,
  onOpen,
}: Readonly<{
  reportApptId: string | null;
  reportLoading: boolean;
  onOpen: () => void;
}>) {
  if (reportApptId) {
    return (
      <InfoCard title="Prescription report">
        <button type="button" className="mr-rx-detail-report-card" onClick={onOpen}>
          <span className="mr-rx-detail-report-card__icon" aria-hidden>
            📄
          </span>
          <span className="mr-rx-detail-report-card__label">View prescription report</span>
          <span className="mr-rx-detail-report-card__chevron" aria-hidden>
            ›
          </span>
        </button>
      </InfoCard>
    );
  }
  if (reportLoading) {
    return (
      <InfoCard title="Prescription report">
        <p className="mr-rx-detail-muted">Loading prescription report…</p>
      </InfoCard>
    );
  }
  return null;
}

function MedicineTile({ med }: Readonly<{ med: PrescriptionMedicineItem }>) {
  const timings = medicineTimings(med);
  const duration = medicineDurationText(med);
  const weekly = medicineWeeklyText(med);

  return (
    <div className={`mr-rx-med-tile${med.isChronic ? " mr-rx-med-tile--chronic" : ""}`}>
      <div className="mr-rx-med-tile__head">
        <span className="mr-rx-med-tile__icon" aria-hidden>💊</span>
        <span className="mr-rx-med-tile__info">
          <span className="mr-rx-med-tile__name">{med.name}</span>
          <span className="mr-rx-med-tile__meta">
            {med.type || "—"}
            {duration ? `  •  ${duration}` : ""}
            {weekly ? `  •  ${weekly}` : ""}
          </span>
        </span>
      </div>
      {timings.length > 0 ? (
        <div className="mr-rx-med-tile__chips">
          {timings.map((t) => {
            const meta = timingChipMeta(t);
            return (
              <span
                key={t}
                className="mr-rx-timing-chip"
                style={{ color: meta.color, background: `${meta.color}1a` }}
              >
                {t}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function MedicalRecordsPrescriptionDetailPage() {
  const toast = useToast();
  const { prescriptionId } = useParams<{ prescriptionId: string }>();
  const location = useLocation();
  const state = (location.state as LocationState | null) ?? {};

  const returnPath =
    state.returnPath ??
    generatePath(ROUTES.medicalRecordsCategory, { categorySlug: "prescriptions" });

  const [row, setRow] = useState<Record<string, unknown> | null>(state.row ?? null);
  const [loading, setLoading] = useState(!state.row);
  const [error, setError] = useState<string | null>(null);
  const [reportApptId, setReportApptId] = useState<string | null>(() =>
    state.row ? prescriptionReportAppointmentId(state.row) : null,
  );
  const [reportLoading, setReportLoading] = useState(false);
  const [pdfViewer, setPdfViewer] = useState<AttachmentFilePreviewViewer>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const id = prescriptionId?.trim() ?? "";

  const closePdfViewer = useCallback(() => {
    setPdfViewer((prev) => {
      if (prev?.url?.startsWith("blob:")) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  useEffect(() => {
    if (state.row) {
      setRow(state.row);
      setReportApptId(prescriptionReportAppointmentId(state.row));
      setLoading(false);
      return;
    }
    if (!id) {
      setError("Prescription not found");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPrescriptionById(id);
        if (!cancelled) {
          setRow(data);
          setReportApptId(prescriptionReportAppointmentId(data));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load prescription");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, state.row]);

  useEffect(() => {
    if (!row || reportApptId || !prescriptionNeedsReportLookup(row) || !id) return;
    let cancelled = false;
    (async () => {
      setReportLoading(true);
      try {
        const detail = await fetchPrescriptionById(id);
        const aid = prescriptionReportAppointmentId(detail);
        if (!cancelled && aid) setReportApptId(aid);
      } catch {
        /* report stays hidden */
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row, reportApptId, id]);

  const openReport = useCallback(async () => {
    const aid = reportApptId;
    if (!aid) return;
    setPdfBusy(true);
    try {
      const url = await fetchConsultationReportPdfObjectUrl(aid);
      setPdfViewer((prev) => {
        if (prev?.url?.startsWith("blob:")) URL.revokeObjectURL(prev.url);
        return { kind: "pdf", url, name: "Prescription.pdf" };
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open prescription report");
    } finally {
      setPdfBusy(false);
    }
  }, [reportApptId, toast]);

  useEffect(() => () => closePdfViewer(), [closePdfViewer]);

  const others = useMemo(() => (row ? prescriptionOtherMedicines(row) : []), [row]);
  const chronic = useMemo(() => (row ? prescriptionChronicMedicines(row) : []), [row]);

  if (loading) {
    return (
      <div className="mr-rx-detail-page">
        <header className="mr-rx-detail-header">
          <FlowScreenBack fallbackTo={returnPath} className="app-back-btn mr-rx-detail-back" />
          <h1 className="mr-rx-detail-header__title">Prescription Detail</h1>
          <span className="mr-rx-detail-header__spacer" aria-hidden />
        </header>
        <p className="mr-rx-detail-loading">Loading…</p>
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="mr-rx-detail-page">
        <header className="mr-rx-detail-header">
          <FlowScreenBack fallbackTo={returnPath} className="app-back-btn mr-rx-detail-back" />
          <h1 className="mr-rx-detail-header__title">Prescription Detail</h1>
          <span className="mr-rx-detail-header__spacer" aria-hidden />
        </header>
        <p className="mr-rx-detail-error" role="alert">
          {error ?? "Prescription not found"}
        </p>
      </div>
    );
  }

  const docName = prescriptionDoctorDisplayName(row);
  const initial = docName.replace(/^dr\.?\s*/i, "").trim().charAt(0).toUpperCase() || "D";
  const exp = prescriptionDoctorExperience(row);
  const rating = prescriptionDoctorRating(row);
  const purpose = prescriptionPurpose(row);
  const diagnosis = prescriptionDiagnosis(row);
  const showApptInfo = purpose.trim().length > 0 || diagnosis.trim().length > 0;

  return (
    <div className="mr-rx-detail-page">
      <header className="mr-rx-detail-header">
        <FlowScreenBack fallbackTo={returnPath} className="app-back-btn mr-rx-detail-back" />
        <h1 className="mr-rx-detail-header__title">Prescription Detail</h1>
        {reportApptId ? (
          <button type="button" className="mr-rx-detail-report-btn" onClick={() => void openReport()}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 3v12m0 0l4-4m-4 4l-4-4M5 21h14"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <span className="mr-rx-detail-header__spacer" aria-hidden />
        )}
      </header>

      <main className="mr-rx-detail-main">
        <StatusBanner row={row} />

        <InfoCard title="Prescribed By">
          <div className="mr-rx-detail-doctor">
            <span className="mr-rx-detail-doctor__avatar" aria-hidden>
              {initial}
            </span>
            <span className="mr-rx-detail-doctor__body">
              <span className="mr-rx-detail-doctor__name">{docName}</span>
              {prescriptionDoctorSpecialty(row) ? (
                <span className="mr-rx-detail-doctor__spec">{prescriptionDoctorSpecialty(row)}</span>
              ) : null}
              {(exp || rating !== null) && (
                <span className="mr-rx-detail-doctor__meta">
                  {exp ? <span>{exp} yrs</span> : null}
                  {rating === null ? null : <span>★ {rating.toFixed(1)}</span>}
                </span>
              )}
            </span>
          </div>
        </InfoCard>

        <PrescriptionReportSection
          reportApptId={reportApptId}
          reportLoading={reportLoading}
          onOpen={() => void openReport()}
        />

        <InfoCard title="Medicines">
          {others.length === 0 && chronic.length === 0 ? (
            <p className="mr-rx-detail-muted">No medicines listed</p>
          ) : (
            <div className="mr-rx-detail-meds">
              {others.map((m, i) => (
                <MedicineTile key={`o-${m.name}-${i}`} med={m} />
              ))}
            </div>
          )}
        </InfoCard>

        {chronic.length > 0 ? (
          <InfoCard title="Chronic Medicines">
            <div className="mr-rx-detail-meds">
              {chronic.map((m, i) => (
                <MedicineTile key={`c-${m.name}-${i}`} med={m} />
              ))}
            </div>
          </InfoCard>
        ) : null}

        {prescriptionNotes(row) ? (
          <InfoCard title="Doctor Notes">
            <p className="mr-rx-detail-notes">{prescriptionNotes(row)}</p>
          </InfoCard>
        ) : null}

        {showApptInfo ? (
          <InfoCard title="Appointment Info">
            <dl className="mr-rx-detail-kv">
              {purpose ? (
                <>
                  <dt>Purpose</dt>
                  <dd>{purpose}</dd>
                </>
              ) : null}
              {diagnosis ? (
                <>
                  <dt>Diagnosis</dt>
                  <dd>{diagnosis}</dd>
                </>
              ) : null}
              <dt>Date</dt>
              <dd>{prescriptionCreatedAtDate(row) || "—"}</dd>
            </dl>
          </InfoCard>
        ) : null}

        {prescriptionRecommendation(row) ? (
          <InfoCard title="Recommendation">
            <p className="mr-rx-detail-notes">{prescriptionRecommendation(row)}</p>
          </InfoCard>
        ) : null}
      </main>

      <AttachmentFilePreview viewer={pdfViewer} onClose={closePdfViewer} />
      {pdfBusy && !pdfViewer ? (
        <p className="sr-only" aria-live="polite">
          Opening prescription report…
        </p>
      ) : null}
    </div>
  );
}
