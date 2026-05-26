const KEY = "opd-mobile-view.selectPeople.pickerDraft.v1";

type PickerDraft = Readonly<{
  scope: string;
  ids: readonly string[];
}>;

/** Stable key per select-people screen instance (flow + route type). */
export function selectPeoplePickerScope(flow: string, type: string): string {
  return `${flow}:${type}`;
}

export function readSelectPeoplePickerIds(scope: string): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw?.trim()) return [];
    const p = JSON.parse(raw) as PickerDraft;
    if (p.scope !== scope || !Array.isArray(p.ids)) return [];
    return p.ids.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export function clearSelectPeoplePickerDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function writeSelectPeoplePickerIds(scope: string, ids: readonly string[]): void {
  try {
    if (ids.length === 0) {
      sessionStorage.removeItem(KEY);
      return;
    }
    const draft: PickerDraft = { scope, ids: [...ids] };
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}
