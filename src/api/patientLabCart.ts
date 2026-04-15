import { patientFetchChecked, patientJson } from "@/api/patientHttp";

function labCartHeaders(): HeadersInit {
  const appName = import.meta.env.VITE_UPLOAD_APP_NAME?.trim() || "co-flip-health";
  return { app_name: appName };
}

export type LabCartProduct = Readonly<{
  id: number;
  name: string;
  category: string;
  tat: number | null;
  fasting_time: number | null;
}>;

export type LabCartItem = Readonly<{
  id: number;
  productId: number;
  qty: number;
  product: LabCartProduct | null;
}>;

export type LabCartPricing = Readonly<{
  collectionFee: number;
  isPaymentRequired: boolean;
  walletModuleAvailable: number | null;
  walletAvailable: number | null;
  walletTotal: number | null;
}>;

export type LabCartSnapshot = Readonly<{
  items: readonly LabCartItem[];
  pricing: LabCartPricing | null;
}>;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseProduct(o: Record<string, unknown>): LabCartProduct | null {
  const id = num(o.id);
  if (id == null) return null;
  const name = typeof o.name === "string" ? o.name : "";
  const category = typeof o.category === "string" ? o.category : "";
  return {
    id,
    name: name || "Lab test",
    category,
    tat: num(o.tat),
    fasting_time: num(o.fasting_time),
  };
}

function parseCartItem(o: Record<string, unknown>): LabCartItem | null {
  const id = num(o.id);
  if (id == null) return null;
  const productIdRaw = o.product_id ?? o.productId;
  const productId = num(productIdRaw) ?? (typeof productIdRaw === "string" ? num(productIdRaw) : null);
  if (productId == null) return null;
  const qty = num(o.qty) ?? 1;
  const prodRaw = o.product;
  const product =
    prodRaw && typeof prodRaw === "object" && !Array.isArray(prodRaw)
      ? parseProduct(prodRaw as Record<string, unknown>)
      : null;
  return { id, productId, qty, product };
}

function parsePricing(root: Record<string, unknown>): LabCartPricing | null {
  const p = root.pricing;
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const o = p as Record<string, unknown>;
  const w =
    o.wallet && typeof o.wallet === "object" && !Array.isArray(o.wallet)
      ? (o.wallet as Record<string, unknown>)
      : null;
  return {
    collectionFee: num(o.collection_fee) ?? 0,
    isPaymentRequired: o.isPaymentRequired === true,
    walletModuleAvailable: w ? num(w.module_available) : null,
    walletAvailable: w ? num(w.available) : null,
    walletTotal: w ? num(w.total) : null,
  };
}

/** POST `/cart/add` — Individual lab tests use `type: "lab"`. */
export async function addLabProductToCart(productId: number): Promise<void> {
  await patientFetchChecked("cart/add", {
    method: "POST",
    headers: labCartHeaders(),
    body: JSON.stringify({ product_id: productId, type: "lab" }),
  });
}

/** GET `/cart/lab` */
export async function fetchLabCart(): Promise<LabCartSnapshot> {
  const raw = await patientJson<unknown>("cart/lab", { method: "GET", headers: labCartHeaders() });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { items: [], pricing: null };
  }
  const root = raw as Record<string, unknown>;
  const itemsRaw = root.items;
  const items: LabCartItem[] = [];
  if (Array.isArray(itemsRaw)) {
    for (const row of itemsRaw) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const parsed = parseCartItem(row as Record<string, unknown>);
      if (parsed) items.push(parsed);
    }
  }
  return { items, pricing: parsePricing(root) };
}

/** DELETE `/cart/remove/lab/:cartItemId` */
export async function removeLabCartItem(cartItemId: number): Promise<void> {
  await patientFetchChecked(`cart/remove/lab/${encodeURIComponent(String(cartItemId))}`, {
    method: "DELETE",
    headers: labCartHeaders(),
  });
}

/** DELETE `/cart/clear/lab` */
export async function clearLabCart(): Promise<void> {
  await patientFetchChecked("cart/clear/lab", {
    method: "DELETE",
    headers: labCartHeaders(),
  });
}
