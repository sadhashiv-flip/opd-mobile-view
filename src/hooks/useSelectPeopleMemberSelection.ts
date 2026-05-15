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
        if (!r?.isSubscribed || r.isChildBlocked) return false;
        return basis.some((s) => s.id === id);
      });
      if (next.length === 0 && !skipAutoPick) {
        const stored = restoreStoredId?.trim() ?? "";
        if (stored) {
          const storedRow = rows.find((r) => r.id === stored);
          if (storedRow?.isSubscribed && !storedRow.isChildBlocked) {
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
  }>,
): (prev: string[]) => string[] {
  return (prev) => {
    const row = rows.find((r) => r.id === memberId);
    if (!row?.isSubscribed || row.isChildBlocked) return prev;
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
