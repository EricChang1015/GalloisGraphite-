"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomUUID } from "node:crypto";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchNewsCandidates,
  type NewsCandidate,
} from "@/lib/news/fetcher";
import { translateNewsArticle } from "@/lib/news/translator";
import { hashTitle, hashUrl, normalizeUrl, slugify } from "@/lib/news/hash";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/i18n/config";
import {
  ApproveNewsArticleSchema,
  FetchNewsCandidatesSchema,
  ImportNewsCandidatesSchema,
  RejectNewsArticleSchema,
  TranslateNewsArticleSchema,
} from "@/lib/validations/admin";

import type { ActionResult } from "./auth";

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Not authenticated." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return { user: null, error: "Admin access required." };
  }
  return { user, error: null };
}

async function writeAuditLog(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>
) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata: (metadata ?? {}) as import("@/types/database").Json,
  });
}

// ---------------------------------------------------------------------------
// Phase 1 — Fetch (LLM → preview only, NOT written to DB)
// ---------------------------------------------------------------------------

export interface FetchedCandidate extends NewsCandidate {
  /** True when this candidate's URL or title already exists in the DB. */
  duplicate: boolean;
  /** Reason for the duplicate flag, when applicable. */
  duplicate_of?: { id: string; status: string } | null;
}

export interface FetchNewsCandidatesResult {
  batch_id: string;
  model: string;
  candidates: FetchedCandidate[];
  fetched_count: number;
  duplicate_count: number;
  prompt_tokens: number;
  completion_tokens: number;
}

const ABSOLUTE_FETCH_TIMEOUT_MS = 55_000;

export async function fetchNewsCandidatesAction(
  input: z.infer<typeof FetchNewsCandidatesSchema>
): Promise<ActionResult<FetchNewsCandidatesResult>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const parsed = FetchNewsCandidatesSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { data: null, error: { message: "Invalid input." } };
  }

  const admin = createAdminClient();
  const batch_id = randomUUID();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ABSOLUTE_FETCH_TIMEOUT_MS);

  try {
    const result = await fetchNewsCandidates({
      limit: parsed.data.limit,
      lookbackDays: parsed.data.lookback_days,
      topicHints: parsed.data.topic_hints,
      signal: controller.signal,
    });

    const flagged = await flagDuplicates(admin, result.items);
    const dupCount = flagged.filter((c) => c.duplicate).length;

    await admin.from("news_fetch_batches").insert({
      id: batch_id,
      triggered_by: user.id,
      model: result.model,
      prompt_tokens: result.promptTokens,
      completion_tokens: result.completionTokens,
      candidate_count: result.items.length,
      duplicate_count: dupCount,
    });

    await writeAuditLog(user.id, "fetch_news_candidates", "news_batch", batch_id, {
      candidate_count: result.items.length,
      duplicate_count: dupCount,
      model: result.model,
    });

    return {
      data: {
        batch_id,
        model: result.model,
        candidates: flagged,
        fetched_count: result.items.length,
        duplicate_count: dupCount,
        prompt_tokens: result.promptTokens,
        completion_tokens: result.completionTokens,
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch news.";
    await admin.from("news_fetch_batches").insert({
      id: batch_id,
      triggered_by: user.id,
      error: message,
    });
    return { data: null, error: { message } };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function flagDuplicates(
  admin: ReturnType<typeof createAdminClient>,
  items: NewsCandidate[]
): Promise<FetchedCandidate[]> {
  const urlHashes: string[] = [];
  const titleHashes: string[] = [];
  const perItem: Array<{ urlHash: string | null; titleHash: string }> = [];

  for (const item of items) {
    const u = hashUrl(item.source_url);
    const t = hashTitle(item.title);
    perItem.push({ urlHash: u, titleHash: t });
    if (u) urlHashes.push(u);
    titleHashes.push(t);
  }

  const existing = new Map<string, { id: string; status: string }>();

  if (urlHashes.length > 0) {
    const { data } = await admin
      .from("news")
      .select("id, status, url_hash")
      .in("url_hash", urlHashes)
      .returns<{ id: string; status: string; url_hash: string }[]>();
    for (const row of data ?? []) {
      existing.set(`url:${row.url_hash}`, { id: row.id, status: row.status });
    }
  }

  if (titleHashes.length > 0) {
    const { data } = await admin
      .from("news")
      .select("id, status, title_hash")
      .in("title_hash", titleHashes)
      .returns<{ id: string; status: string; title_hash: string }[]>();
    for (const row of data ?? []) {
      existing.set(`title:${row.title_hash}`, { id: row.id, status: row.status });
    }
  }

  return items.map((item, idx) => {
    const { urlHash, titleHash } = perItem[idx];
    const dupByUrl = urlHash ? existing.get(`url:${urlHash}`) : undefined;
    const dupByTitle = existing.get(`title:${titleHash}`);
    const hit = dupByUrl ?? dupByTitle ?? null;
    return {
      ...item,
      duplicate: hit !== null,
      duplicate_of: hit,
    };
  });
}

// ---------------------------------------------------------------------------
// Phase 2 — Import to pending queue (with dedup)
// ---------------------------------------------------------------------------

export interface ImportNewsCandidatesResult {
  inserted_count: number;
  skipped_count: number;
  inserted_ids: string[];
}

export async function importNewsCandidatesAction(
  input: z.infer<typeof ImportNewsCandidatesSchema>
): Promise<ActionResult<ImportNewsCandidatesResult>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const parsed = ImportNewsCandidatesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: {
        message: "Invalid input.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      },
    };
  }

  const admin = createAdminClient();
  const inserted_ids: string[] = [];
  let skipped = 0;

  // Pre-fetch existing hashes for this batch so we skip duplicates without
  // racing against the unique index (which would still catch us, but the
  // pre-check lets us tell the admin exactly what was skipped).
  const candidateUrlHashes = parsed.data.candidates
    .map((c) => hashUrl(c.source_url))
    .filter((h): h is string => Boolean(h));
  const candidateTitleHashes = parsed.data.candidates.map((c) => hashTitle(c.title));

  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  if (candidateUrlHashes.length > 0) {
    const { data } = await admin
      .from("news")
      .select("url_hash")
      .in("url_hash", candidateUrlHashes)
      .returns<{ url_hash: string | null }[]>();
    for (const row of data ?? []) {
      if (row.url_hash) seenUrls.add(row.url_hash);
    }
  }
  if (candidateTitleHashes.length > 0) {
    const { data } = await admin
      .from("news")
      .select("title_hash")
      .in("title_hash", candidateTitleHashes)
      .returns<{ title_hash: string | null }[]>();
    for (const row of data ?? []) {
      if (row.title_hash) seenTitles.add(row.title_hash);
    }
  }

  for (const candidate of parsed.data.candidates) {
    const normalizedUrl = normalizeUrl(candidate.source_url);
    if (!normalizedUrl) {
      skipped++;
      continue;
    }
    const url_hash = hashUrl(candidate.source_url);
    const title_hash = hashTitle(candidate.title);
    if (
      (url_hash && seenUrls.has(url_hash)) ||
      seenTitles.has(title_hash)
    ) {
      skipped++;
      continue;
    }

    const slug = await pickAvailableSlug(admin, slugify(candidate.title));
    const publishedAt = parseDateOrNull(candidate.published_at);

    const { data: inserted, error } = await admin
      .from("news")
      .insert({
        title: candidate.title,
        slug,
        summary: candidate.summary,
        content_html: buildContentHtml(candidate),
        source_url: normalizedUrl,
        source_name: candidate.source_name ?? null,
        url_hash,
        title_hash,
        relevance_score: candidate.relevance_score ?? null,
        fetched_at: new Date().toISOString(),
        fetch_batch_id: parsed.data.batch_id,
        published_at: publishedAt,
        language: "en",
        status: "pending",
        is_published: false,
      })
      .select("id")
      .single<{ id: string }>();

    if (error || !inserted) {
      skipped++;
      continue;
    }
    inserted_ids.push(inserted.id);
    if (url_hash) seenUrls.add(url_hash);
    seenTitles.add(title_hash);
  }

  await admin
    .from("news_fetch_batches")
    .update({ imported_count: inserted_ids.length })
    .eq("id", parsed.data.batch_id);

  await writeAuditLog(user.id, "import_news_candidates", "news_batch", parsed.data.batch_id, {
    inserted: inserted_ids.length,
    skipped,
  });

  revalidatePath("/admin/news");

  return {
    data: {
      inserted_count: inserted_ids.length,
      skipped_count: skipped,
      inserted_ids,
    },
    error: null,
  };
}

async function pickAvailableSlug(
  admin: ReturnType<typeof createAdminClient>,
  base: string
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomUUID().slice(0, 6)}`;
    const { data } = await admin
      .from("news")
      .select("id")
      .eq("slug", slug)
      .maybeSingle<{ id: string }>();
    if (!data) return slug;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

function parseDateOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function buildContentHtml(c: {
  title: string;
  summary: string;
  source_url: string;
  source_name?: string | null;
}): string {
  const safeSummary = escapeHtml(c.summary);
  const safeUrl = escapeHtml(c.source_url);
  const sourceLabel = escapeHtml(c.source_name ?? hostnameOf(c.source_url));
  return `<p>${safeSummary}</p>
<p class="text-muted"><em>Source: <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${sourceLabel}</a></em></p>`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Phase 3 — Approve / Reject / Translate
// ---------------------------------------------------------------------------

export async function approveNewsArticleAction(
  input: z.infer<typeof ApproveNewsArticleSchema>
): Promise<ActionResult<true>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const parsed = ApproveNewsArticleSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  const admin = createAdminClient();
  const { error } = await admin
    .from("news")
    .update({
      status: "published",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejected_reason: null,
    })
    .eq("id", parsed.data.news_id);

  if (error) return { data: null, error: { message: error.message } };

  await writeAuditLog(user.id, "approve_news", "news", parsed.data.news_id);
  revalidatePath("/admin/news");
  revalidatePath("/news");

  return { data: true, error: null };
}

export async function rejectNewsArticleAction(
  input: z.infer<typeof RejectNewsArticleSchema>
): Promise<ActionResult<true>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const parsed = RejectNewsArticleSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  const admin = createAdminClient();
  const { error } = await admin
    .from("news")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejected_reason: parsed.data.reason ?? null,
    })
    .eq("id", parsed.data.news_id);

  if (error) return { data: null, error: { message: error.message } };

  await writeAuditLog(user.id, "reject_news", "news", parsed.data.news_id, {
    reason: parsed.data.reason ?? null,
  });
  revalidatePath("/admin/news");
  revalidatePath("/news");

  return { data: true, error: null };
}

export async function unpublishNewsArticleAction(
  newsId: string
): Promise<ActionResult<true>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const admin = createAdminClient();
  const { error } = await admin
    .from("news")
    .update({
      status: "pending",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", newsId);

  if (error) return { data: null, error: { message: error.message } };

  await writeAuditLog(user.id, "unpublish_news", "news", newsId);
  revalidatePath("/admin/news");
  revalidatePath("/news");

  return { data: true, error: null };
}

export interface TranslateResult {
  locale: string;
  slug: string;
}

export async function translateNewsArticleAction(
  input: z.infer<typeof TranslateNewsArticleSchema>
): Promise<ActionResult<TranslateResult>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const parsed = TranslateNewsArticleSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  if (!isSupportedLocale(parsed.data.locale)) {
    return {
      data: null,
      error: {
        message: `Unsupported locale. Allowed: ${SUPPORTED_LOCALES.join(", ")}.`,
      },
    };
  }
  const locale = parsed.data.locale;

  const admin = createAdminClient();
  const { data: article, error: fetchErr } = await admin
    .from("news")
    .select("id, title, summary, content_html")
    .eq("id", parsed.data.news_id)
    .single<{
      id: string;
      title: string;
      summary: string | null;
      content_html: string | null;
    }>();

  if (fetchErr || !article) {
    return { data: null, error: { message: "Article not found." } };
  }

  let translation;
  try {
    translation = await translateNewsArticle({
      title: article.title,
      summary: article.summary,
      contentHtml: article.content_html,
      targetLocale: locale,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Translation failed.";
    return { data: null, error: { message } };
  }

  const baseSlug = slugify(translation.title);
  const slug = await pickAvailableTranslationSlug(admin, locale, baseSlug);

  const { error: upsertErr } = await admin.from("news_translations").upsert(
    {
      news_id: article.id,
      locale,
      title: translation.title,
      summary: translation.summary,
      content_html: translation.content_html,
      slug,
      translator_id: user.id,
      translated_at: new Date().toISOString(),
      is_auto: true,
    },
    { onConflict: "news_id,locale" }
  );

  if (upsertErr) return { data: null, error: { message: upsertErr.message } };

  await writeAuditLog(user.id, "translate_news", "news", article.id, { locale });
  revalidatePath("/admin/news");
  revalidatePath("/news");

  return { data: { locale, slug }, error: null };
}

async function pickAvailableTranslationSlug(
  admin: ReturnType<typeof createAdminClient>,
  locale: string,
  base: string
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomUUID().slice(0, 6)}`;
    const { data } = await admin
      .from("news_translations")
      .select("id")
      .eq("locale", locale)
      .eq("slug", slug)
      .maybeSingle<{ id: string }>();
    if (!data) return slug;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}
