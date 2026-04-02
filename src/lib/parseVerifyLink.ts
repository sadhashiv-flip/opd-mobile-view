/** Values returned by POST /patient/verify `link` when account linking is required. */
export type VerifyLinkKind = "NONE" | "PHONE" | "EMAIL";

export function parseVerifyLinkKind(
  link: string | null | undefined,
): VerifyLinkKind {
  const u = (link ?? "").trim().toUpperCase();
  if (u === "PHONE") return "PHONE";
  if (u === "EMAIL") return "EMAIL";
  if (u === "NONE" || u === "") return "NONE";
  return "NONE";
}
