import { patientJsonRoot } from "@/api/patientHttp";

const LEGAL_CONTENT_BASE = "legal-content";

export type LegalFaqQuestion = Readonly<{
  question: string;
  answer: string;
}>;

export type LegalFaqCategory = Readonly<{
  category: string;
  title: string;
  questions: readonly LegalFaqQuestion[];
}>;

export type LegalHtmlContent = Readonly<{
  html: string;
  updatedAt: Date | null;
  message: string | null;
}>;

type LegalContentEnvelope = Readonly<{
  type?: unknown;
  content?: unknown;
  updated_at?: unknown;
  message?: unknown;
}>;

function parseUpdatedAt(raw: unknown): Date | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function readEnvelopeMessage(data: LegalContentEnvelope): string | null {
  const msg = data.message;
  return typeof msg === "string" && msg.trim() ? msg.trim() : null;
}

function parseFaqCategories(raw: unknown): readonly LegalFaqCategory[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((block) => {
    if (!block || typeof block !== "object") return [];
    const o = block as Record<string, unknown>;
    const category = (o.category as unknown)?.toString().trim() ?? "";
    const title = (o.title as unknown)?.toString().trim() ?? category;
    const questionsRaw = o.questions;
    if (!Array.isArray(questionsRaw)) {
      return [{ category, title, questions: [] }];
    }

    const questions: LegalFaqQuestion[] = questionsRaw.flatMap((q) => {
      if (!q || typeof q !== "object") return [];
      const row = q as Record<string, unknown>;
      const question = (row.question as unknown)?.toString().trim() ?? "";
      const answer = (row.answer as unknown)?.toString().trim() ?? "";
      if (!question) return [];
      return [{ question, answer }];
    });

    return [{ category, title, questions }];
  });
}

function parseHtmlContent(data: LegalContentEnvelope): LegalHtmlContent {
  const html =
    typeof data.content === "string"
      ? data.content
      : data.content == null
        ? ""
        : String(data.content);
  return {
    html,
    updatedAt: parseUpdatedAt(data.updated_at),
    message: readEnvelopeMessage(data),
  };
}

async function fetchLegalEnvelope(slug: string): Promise<LegalContentEnvelope> {
  return patientJsonRoot<LegalContentEnvelope>(`${LEGAL_CONTENT_BASE}/${slug}`, {
    method: "GET",
  });
}

/** GET `/legal-content/faq` */
export async function fetchLegalFaq(): Promise<readonly LegalFaqCategory[]> {
  const data = await fetchLegalEnvelope("faq");
  return parseFaqCategories(data.content);
}

/** GET `/legal-content/privacy_policy` */
export async function fetchLegalPrivacyPolicy(): Promise<LegalHtmlContent> {
  const data = await fetchLegalEnvelope("privacy_policy");
  return parseHtmlContent(data);
}

/** GET `/legal-content/terms_and_conditions` */
export async function fetchLegalTermsAndConditions(): Promise<LegalHtmlContent> {
  const data = await fetchLegalEnvelope("terms_and_conditions");
  return parseHtmlContent(data);
}
