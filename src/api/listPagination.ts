/** Shared `page` / `limit` query params for patient list GET endpoints. */

export const DEFAULT_LIST_PAGE_SIZE = 20;

export type ListPaginationOpts = Readonly<{
  page?: number;
  limit?: number;
}>;

export function resolveListPagination(opts?: ListPaginationOpts): { page: number; limit: number } {
  const page = opts?.page != null && opts.page > 0 ? Math.floor(opts.page) : 1;
  const limit =
    opts?.limit != null && opts.limit > 0 ? Math.floor(opts.limit) : DEFAULT_LIST_PAGE_SIZE;
  return { page, limit };
}

/**
 * Merges `page` and `limit` into a path's query string (defaults: page=1, limit={@link DEFAULT_LIST_PAGE_SIZE}).
 * Use with {@link patientJsonList} from `@/api/patientHttp` for all list GETs.
 */
export function applyListPaginationToPath(path: string, pagination?: ListPaginationOpts): string {
  const qMark = path.indexOf("?");
  const base = qMark >= 0 ? path.slice(0, qMark) : path;
  const existing = qMark >= 0 ? path.slice(qMark + 1) : "";
  const q = new URLSearchParams(existing);
  const { page, limit } = resolveListPagination(pagination);
  q.set("page", String(page));
  q.set("limit", String(limit));
  return `${base}?${q.toString()}`;
}

function batchIdentityKey(item: unknown): string | null {
  if (item !== null && typeof item === "object" && "id" in item) {
    const id = (item as { id: unknown }).id;
    if (typeof id === "number" || typeof id === "string") return String(id);
  }
  return null;
}

/**
 * Loads every page until the API returns an empty batch, a short page (`< limit`),
 * a **duplicate** page (same `id`s as the previous page — happens when the backend ignores `page`),
 * or `maxPages` is reached.
 */
export async function fetchAllListPages<T>(
  fetchOnePage: (opts: ListPaginationOpts) => Promise<readonly T[]>,
  options?: Readonly<{ perPage?: number; maxPages?: number }>,
): Promise<T[]> {
  const limit = options?.perPage ?? DEFAULT_LIST_PAGE_SIZE;
  const maxPages = options?.maxPages ?? 100;
  const acc: T[] = [];
  let prevIdSig: string | null = null;
  for (let page = 1; page <= maxPages; page++) {
    const batch = await fetchOnePage({ page, limit });
    if (batch.length === 0) break;
    const keys = batch.map(batchIdentityKey).filter((k): k is string => k != null);
    const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const sig = keys.length === batch.length ? sortedKeys.join("\0") : null;
    if (sig != null && sig === prevIdSig) break;
    prevIdSig = sig;
    acc.push(...batch);
    if (batch.length < limit) break;
  }
  return acc;
}
