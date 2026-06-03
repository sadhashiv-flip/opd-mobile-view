/** Navigation state for `/services/help-support` (tickets list + propagated to chat). */
export type HelpSupportLocationState = Readonly<{
  returnPath?: string;
  /** Set when opened from bottom nav “Need Help?” — shows tab bar, hides back. */
  fromBottomNav?: boolean;
}>;

export function isHelpSupportFromBottomNav(state: unknown): boolean {
  return Boolean((state as HelpSupportLocationState | null)?.fromBottomNav);
}
