/** Display helpers for support ticket list — aligned with patient_app `TicketCard`. */

export function formatSupportTicketStatusLabel(status: string | null): string {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === "0" || normalized === "created") return "Created";
  if (normalized === "1" || normalized === "active") return "Active";
  if (normalized === "2" || normalized === "inactive") return "Inactive";
  if (normalized === "closed") return "Closed";
  if (normalized === "resolved") return "Resolved";
  if (normalized === "completed") return "Completed";
  return status?.trim() || "Open";
}

export type SupportTicketStatusVisual = Readonly<{
  label: string;
  dotColor: string;
  badgeColor: string;
  badgeBg: string;
}>;

export function supportTicketStatusVisual(status: string | null): SupportTicketStatusVisual {
  const label = formatSupportTicketStatusLabel(status);
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === "0" || normalized === "created") {
    return { label, dotColor: "#3b82f6", badgeColor: "#2563eb", badgeBg: "#dbeafe" };
  }
  if (normalized === "1" || normalized === "active") {
    return { label, dotColor: "#16a34a", badgeColor: "#15803d", badgeBg: "#dcfce7" };
  }
  if (
    normalized === "2" ||
    normalized === "inactive" ||
    normalized === "closed" ||
    normalized === "resolved" ||
    normalized === "completed"
  ) {
    return { label, dotColor: "#64748b", badgeColor: "#475569", badgeBg: "#f1f5f9" };
  }
  return { label, dotColor: "#3b82f6", badgeColor: "#2563eb", badgeBg: "#dbeafe" };
}

export function formatSupportTicketDate(createdAt: string | null): string {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
