/** How the user opened `/services` — mirrors Flutter dashboard tab vs `allServices` push. */
export type ServicesHubLocationState = Readonly<{
  fromViewMore?: boolean;
}>;

export function isServicesHubFromViewMore(state: unknown): boolean {
  return Boolean((state as ServicesHubLocationState | null)?.fromViewMore);
}
