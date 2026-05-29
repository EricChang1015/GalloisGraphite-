"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  PlusIcon,
  PencilIcon,
  DownloadIcon,
  CheckIcon,
  XIcon,
  LanguagesIcon,
  ExternalLinkIcon,
  Loader2Icon,
  ArchiveIcon,
} from "lucide-react";
import type { z } from "zod";

import { NewsInputSchema } from "@/lib/validations/admin";
import {
  upsertNews,
} from "@/actions/admin";
import {
  approveNewsArticleAction,
  fetchNewsCandidatesAction,
  importNewsCandidatesAction,
  rejectNewsArticleAction,
  translateNewsArticleAction,
  unpublishNewsArticleAction,
  type FetchedCandidate,
} from "@/actions/admin-news";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

type NewsInput = z.infer<typeof NewsInputSchema>;

interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content_html: string | null;
  cover_image_url: string | null;
  is_published: boolean;
  status?: "draft" | "pending" | "approved" | "published" | "rejected";
  translations?: { locale: string; slug: string }[];
}

// ---------------------------------------------------------------------------
// Manual create / edit form (unchanged behaviour)
// ---------------------------------------------------------------------------

export function NewsFormDialog({
  existing,
  className,
}: {
  existing?: NewsArticle;
  className?: string;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<NewsInput>({
    resolver: zodResolver(NewsInputSchema) as never,
    defaultValues: {
      id: existing?.id,
      title: existing?.title ?? "",
      slug: existing?.slug ?? "",
      summary: existing?.summary ?? "",
      content_html: existing?.content_html ?? "",
      cover_image_url: existing?.cover_image_url ?? "",
      is_published: existing?.is_published ?? false,
    },
  });

  function onSubmit(values: NewsInput) {
    startTransition(async () => {
      const result = await upsertNews(values);
      if (result.error) { toast.error(result.error.message); return; }
      toast.success(existing ? t("news.form.updated") : t("news.form.created"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          existing ? (
            <Button size="sm" variant="outline" className={cn("h-7 text-xs", className)} />
          ) : (
            <Button size="sm" variant="outline" className={className} />
          )
        }
      >
        {existing ? (
          <><PencilIcon className="w-3 h-3 mr-1" />{tCommon("actions.edit")}</>
        ) : (
          <><PlusIcon className="w-4 h-4 mr-2" />{t("news.manualArticle")}</>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? t("news.form.editArticle") : t("news.form.newArticle")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("news.form.title")}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("news.form.slug")}</FormLabel>
                  <FormControl><Input placeholder={t("news.form.slugPlaceholder")} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cover_image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("news.form.coverUrl")}</FormLabel>
                  <FormControl><Input type="url" placeholder="https://..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("news.form.summary")}</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="content_html"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("news.form.contentHtml")}</FormLabel>
                  <FormControl><Textarea rows={8} className="font-mono text-xs" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_published"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">{t("news.form.publishImmediately")}</FormLabel>
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{tCommon("actions.cancel")}</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? tCommon("actions.saving") : tCommon("actions.save")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Fetch news (LLM → preview dialog → import)
// ---------------------------------------------------------------------------

type CandidateState = FetchedCandidate & {
  selected: boolean;
};

export function FetchNewsButton({ className }: { className?: string }) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isImporting, startImporting] = useTransition();
  const [batchId, setBatchId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateState[]>([]);
  const [meta, setMeta] = useState<{ model: string; promptTokens: number; completionTokens: number } | null>(null);
  const [lookback, setLookback] = useState(7);
  const [limit, setLimit] = useState(12);

  async function runFetch() {
    setIsFetching(true);
    setCandidates([]);
    setBatchId(null);
    setMeta(null);
    try {
      const res = await fetchNewsCandidatesAction({
        limit,
        lookback_days: lookback,
      });
      if (res.error || !res.data) {
        toast.error(res.error?.message ?? "Failed to fetch.");
        return;
      }
      setBatchId(res.data.batch_id);
      setMeta({
        model: res.data.model,
        promptTokens: res.data.prompt_tokens,
        completionTokens: res.data.completion_tokens,
      });
      setCandidates(
        res.data.candidates.map((c) => ({
          ...c,
          selected: !c.duplicate,
        }))
      );
      if (res.data.candidates.length === 0) {
        toast.info(t("news.fetch.noCandidatesReturned"));
      } else {
        toast.success(
          t("news.fetch.fetchedSummary", {
            count: res.data.fetched_count,
            duplicates: res.data.duplicate_count,
          })
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fetch failed.";
      toast.error(message);
    } finally {
      setIsFetching(false);
    }
  }

  function toggleSelect(idx: number) {
    setCandidates((curr) => curr.map((c, i) => (i === idx ? { ...c, selected: !c.selected } : c)));
  }

  function selectAll(selected: boolean, onlyNonDuplicate = true) {
    setCandidates((curr) =>
      curr.map((c) => ({
        ...c,
        selected: onlyNonDuplicate && c.duplicate ? false : selected,
      }))
    );
  }

  function runImport() {
    if (!batchId) return;
    const picked = candidates.filter((c) => c.selected);
    if (picked.length === 0) {
      toast.error(t("news.fetch.pickOne"));
      return;
    }
    startImporting(async () => {
      const res = await importNewsCandidatesAction({
        batch_id: batchId,
        candidates: picked.map((c) => ({
          title: c.title,
          summary: c.summary,
          source_url: c.source_url,
          source_name: c.source_name ?? null,
          published_at: c.published_at ?? null,
          relevance_score: c.relevance_score ?? null,
        })),
      });
      if (res.error || !res.data) {
        toast.error(res.error?.message ?? "Import failed.");
        return;
      }
      toast.success(
        t("news.fetch.importedSummary", {
          inserted: res.data.inserted_count,
          skipped: res.data.skipped_count,
        })
      );
      setOpen(false);
      setCandidates([]);
      setBatchId(null);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className={className} />}>
        <DownloadIcon className="w-4 h-4 mr-2" />
        {t("news.fetchLatest")}
      </DialogTrigger>
      <DialogContent className="max-h-[min(92vh,800px)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("news.fetch.dialogTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{t("news.fetch.lookback")}</label>
            <Input
              type="number"
              min={1}
              max={30}
              value={lookback}
              onChange={(e) => setLookback(Math.max(1, Math.min(30, Number(e.target.value) || 7)))}
              className="w-24"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{t("news.fetch.maxItems")}</label>
            <Input
              type="number"
              min={3}
              max={25}
              value={limit}
              onChange={(e) => setLimit(Math.max(3, Math.min(25, Number(e.target.value) || 12)))}
              className="w-24"
            />
          </div>
          <Button onClick={runFetch} disabled={isFetching} size="sm">
            {isFetching ? (
              <><Loader2Icon className="w-4 h-4 mr-2 animate-spin" />{t("news.fetch.askingLlm")}</>
            ) : (
              <><DownloadIcon className="w-4 h-4 mr-2" />{t("news.fetch.fetch")}</>
            )}
          </Button>
          {meta && (
            <p className="text-xs text-muted-foreground ml-auto">
              {t("news.fetch.modelTokens", {
                model: meta.model,
                tokens: meta.promptTokens + meta.completionTokens,
              })}
            </p>
          )}
        </div>

        <div className="max-h-[55vh] overflow-y-auto rounded-md border border-border divide-y divide-border">
          {candidates.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {isFetching ? t("news.fetch.searching") : t("news.fetch.noCandidates")}
            </div>
          ) : (
            candidates.map((c, idx) => (
              <div key={`${c.source_url}-${idx}`} className="p-3 flex gap-3">
                <input
                  type="checkbox"
                  checked={c.selected}
                  onChange={() => toggleSelect(idx)}
                  className="mt-1 h-4 w-4"
                  disabled={c.duplicate}
                  aria-label="Select candidate"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-sm leading-snug">{c.title}</h4>
                    {c.duplicate && (
                      <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/40">
                        {t("news.fetch.duplicateBadge", {
                          status: c.duplicate_of?.status ?? "?",
                        })}
                      </Badge>
                    )}
                    {typeof c.relevance_score === "number" && (
                      <Badge variant="outline" className="text-[10px]">
                        {t("news.fetch.scoreBadge", { score: c.relevance_score.toFixed(2) })}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{c.summary}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80">
                    <a
                      href={c.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[color:var(--gold)] hover:underline inline-flex items-center gap-1"
                    >
                      {c.source_name ?? c.source_url}
                      <ExternalLinkIcon className="w-3 h-3" />
                    </a>
                    {c.published_at && <span>· {c.published_at}</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => selectAll(true)} disabled={candidates.length === 0}>
              {t("news.fetch.selectAllNew")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => selectAll(false, false)} disabled={candidates.length === 0}>
              {t("news.fetch.clear")}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              {tCommon("actions.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={runImport}
              disabled={isImporting || candidates.length === 0 || !batchId}
            >
              {isImporting ? (
                <><Loader2Icon className="w-4 h-4 mr-2 animate-spin" />{t("news.fetch.importing")}</>
              ) : (
                <>{t("news.fetch.import", { count: candidates.filter((c) => c.selected).length })}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Per-row actions (approve / reject / translate / edit / unpublish)
// ---------------------------------------------------------------------------

export function NewsRowActions({
  article,
  compact = false,
}: {
  article: NewsArticle;
  compact?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);

  const status = article.status ?? (article.is_published ? "published" : "draft");
  const actionBtnClass = compact ? "h-9 w-full text-xs justify-center" : "h-7 text-xs";

  function approve() {
    startTransition(async () => {
      const res = await approveNewsArticleAction({ news_id: article.id });
      if (res.error) { toast.error(res.error.message); return; }
      toast.success(t("news.actions.published"));
      router.refresh();
    });
  }

  function unpublish() {
    startTransition(async () => {
      const res = await unpublishNewsArticleAction(article.id);
      if (res.error) { toast.error(res.error.message); return; }
      toast.success(t("news.actions.movedToPending"));
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        compact ? "grid w-full grid-cols-2 gap-2" : "flex flex-wrap justify-end gap-1.5"
      )}
    >
      {(status === "pending" || status === "draft" || status === "rejected") && (
        <Button
          size="sm"
          variant="outline"
          className={actionBtnClass}
          onClick={approve}
          disabled={isPending}
        >
          <CheckIcon className="w-3 h-3 mr-1" />{t("news.actions.approve")}
        </Button>
      )}
      {status === "pending" && (
        <Button
          size="sm"
          variant="outline"
          className={cn(
            actionBtnClass,
            "text-red-400 border-red-400/40 hover:text-red-300"
          )}
          onClick={() => setRejectOpen(true)}
          disabled={isPending}
        >
          <XIcon className="w-3 h-3 mr-1" />{t("news.actions.reject")}
        </Button>
      )}
      {status === "published" && (
        <Button
          size="sm"
          variant="outline"
          className={actionBtnClass}
          onClick={unpublish}
          disabled={isPending}
        >
          <ArchiveIcon className="w-3 h-3 mr-1" />{t("news.actions.unpublish")}
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className={actionBtnClass}
        onClick={() => setTranslateOpen(true)}
      >
        <LanguagesIcon className="w-3 h-3 mr-1" />{t("news.actions.translate")}
      </Button>
      <NewsFormDialog
        className={compact ? "col-span-2 h-9 w-full justify-center text-xs" : undefined}
        existing={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          content_html: article.content_html,
          cover_image_url: article.cover_image_url,
          is_published: article.is_published,
        }}
      />

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        newsId={article.id}
      />
      <TranslateDialog
        open={translateOpen}
        onOpenChange={setTranslateOpen}
        article={article}
      />
    </div>
  );
}


function RejectDialog({
  open,
  onOpenChange,
  newsId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newsId: string;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await rejectNewsArticleAction({
        news_id: newsId,
        reason: reason || null,
      });
      if (res.error) { toast.error(res.error.message); return; }
      toast.success(t("news.actions.rejectedToast"));
      onOpenChange(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("news.reject.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("news.reject.hint")}</p>
          <Textarea
            placeholder={t("news.reject.reasonPlaceholder")}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{tCommon("actions.cancel")}</Button>
          <Button variant="destructive" size="sm" onClick={submit} disabled={isPending}>
            {isPending ? t("news.reject.rejecting") : t("news.actions.reject")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TranslateDialog({
  open,
  onOpenChange,
  article,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article: NewsArticle;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);
  const existingLocales = new Set((article.translations ?? []).map((t) => t.locale));

  // Locales we'd actually translate INTO (skip "en" since source is en)
  const translatable = SUPPORTED_LOCALES.filter((loc) => loc !== "en");

  async function translate(locale: Locale) {
    setPendingLocale(locale);
    try {
      const res = await translateNewsArticleAction({
        news_id: article.id,
        locale,
      });
      if (res.error || !res.data) {
        toast.error(res.error?.message ?? "Translation failed.");
        return;
      }
      toast.success(t("news.translate.success", { locale }));
      router.refresh();
    } finally {
      setPendingLocale(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("news.translate.title")}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground mb-3">{t("news.translate.hint")}</p>
        <div className="space-y-2">
          {translatable.map((loc) => {
            const have = existingLocales.has(loc);
            const busy = pendingLocale === loc;
            return (
              <div key={loc} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{loc}</span>
                  {have && (
                    <Badge variant="outline" className="text-[10px] text-green-400 border-green-400/40">
                      {t("news.translate.done")}
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => translate(loc)}
                  disabled={busy || pendingLocale !== null}
                >
                  {busy ? (
                    <><Loader2Icon className="w-3 h-3 mr-1 animate-spin" />{t("news.translate.translating")}</>
                  ) : have ? (
                    t("news.translate.retranslate")
                  ) : (
                    t("news.actions.translate")
                  )}
                </Button>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{tCommon("actions.close")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
