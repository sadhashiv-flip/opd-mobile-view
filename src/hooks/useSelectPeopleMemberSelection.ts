import { useEffect } from "react";
import {
  defaultGymMemberSelection,
  type GymMemberListRow,
} from "@/lib/gymMemberDisplay";

export type UseSelectPeopleMemberSelectionOpts = Readonly<{
  rows: GymMemberListRow[];
  /** Rows used for auto-pick / filter (e.g. AHC-eligible subset). */
  selectionBasisRows?: GymMemberListRow[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  maxSelectable?: number;
  /** When true, never auto-select a default member. */
  skipAutoPick?: boolean;
  /** When true, re-tapping selected member clears selection. */
  allowDeselect?: boolean;
  /** Optional stored id to restore (e.g. consultation sheet). */
  restoreStoredId?: string | null;
  /** When true (dental), keep selections without subscription / child-age gates. */
  relaxMemberRestrictions?: boolean;
  enabled?: boolean;
}>;

export function useSelectPeopleMemberSelection({
  rows,
  selectionBasisRows,
  setSelectedIds,
  maxSelectable = 1,
  skipAutoPick = false,
  allowDeselect = false,
  restoreStoredId = null,
  relaxMemberRestrictions = false,
  enabled = true,
}: UseSelectPeopleMemberSelectionOpts): void {
  const basis = selectionBasisRows ?? rows;

  useEffect(() => {
    if (!enabled) return;
    if (basis.length === 0) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds((prev) => {
      let next = prev.filter((id) => {
        const r = rows.find((x) => x.id === id);
        if (!r) return false;
        if (!relaxMemberRestrictions && !r.isSubscribed) {
          return false;
        }
        return basis.some((s) => s.id === id);
      });
      if (next.length === 0 && !skipAutoPick) {
        const stored = restoreStoredId?.trim() ?? "";
        if (stored) {
          const storedRow = rows.find((r) => r.id === stored);
          const storedOk =
            storedRow &&
            (relaxMemberRestrictions || storedRow.isSubscribed);
          if (storedOk) {
            next = [stored];
          }
        }
        if (next.length === 0) next = defaultGymMemberSelection(basis);
      }
      if (next.length > maxSelectable) next = next.slice(0, maxSelectable);
      return next;
    });
  }, [
    basis,
    rows,
    setSelectedIds,
    maxSelectable,
    skipAutoPick,
    restoreStoredId,
    relaxMemberRestrictions,
    enabled,
  ]);

}

export function toggleSelectPeopleMember(
  memberId: string,
  rows: GymMemberListRow[],
  opts: Readonly<{
    allowDeselect: boolean;
    restrictToAhcSelection?: boolean;
    isHealthCheckupsDiagnostics?: boolean;
    /** When true (dental), skip subscription and child-age gates. */
    relaxMemberRestrictions?: boolean;
  }>,
): (prev: string[]) => string[] {
  return (prev) => {
    const row = rows.find((r) => r.id === memberId);
    if (!row) return prev;
    if (!opts.relaxMemberRestrictions && row.isChildBlocked) {
      return prev;
    }
    if (!opts.relaxMemberRestrictions && !row.isSubscribed) {
      return prev;
    }
    if (
      opts.isHealthCheckupsDiagnostics &&
      opts.restrictToAhcSelection &&
      !row.ahcAvailable
    ) {
      return prev;
    }
    if (prev.includes(memberId)) {
      return opts.allowDeselect ? [] : prev;
    }
    return [memberId];
  };
}
