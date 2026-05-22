export type OrderDetailCancellationReasonProps = Readonly<{
  reason: string;
  /** `banner` — under status banner; `inline` — service-request status card */
  variant?: "banner" | "inline";
}>;

/**
 * patient_app `CancellationReasonSection` — cancellation note on order detail.
 */
export function OrderDetailCancellationReason({
  reason,
  variant = "banner",
}: OrderDetailCancellationReasonProps) {
  const text = reason.trim();
  if (!text) return null;

  if (variant === "inline") {
    return (
      <>
        <p className="od-sr-status__cancel-label">Cancellation reason</p>
        <p className="od-sr-status__cancel-text">{text}</p>
      </>
    );
  }

  return (
    <div className="od-banner__cancel-reason-block">
      <p className="od-banner__cancel-reason-label">Cancellation reason</p>
      <p className="od-banner__cancel-reason">{text}</p>
    </div>
  );
}
