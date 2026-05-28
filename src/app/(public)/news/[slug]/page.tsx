import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon } from "lucide-react";
import { getLocale } from "@/i18n/get-locale";
import { isSupportedLocale } from "@/i18n/config";

interface PageProps {
  params: Promise<{ slug: string }>;
}

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content_html: string | null;
  cover_image_url: string | null;
  source_url: string | null;
  source_name: string | null;
  published_at: string | null;
  created_at: string;
  translations: {
    locale: string;
    slug: string;
    title: string;
    summary: string | null;
    content_html: string | null;
  }[];
};

/**
 * Resolve a slug to an article. The slug might be either the English (master)
 * slug stored on `news.slug`, or a translated slug from
 * `news_translations.slug` (any locale).
 *
 * Returns the matched article together with the locale that the URL slug
 * implied (null when the URL pointed at the English master slug). This lets
 * the caller pin the rendered locale to the URL — so clicking the "zh-CN"
 * switcher actually shows Chinese regardless of the user's cookie preference.
 */
async function findArticleBySlug(
  slug: string
): Promise<{ article: ArticleRow; urlLocale: string | null } | null> {
  const supabase = await createServerClient();
  const baseSelect = `id, title, slug, summary, content_html, cover_image_url, source_url, source_name, published_at, created_at,
    translations:news_translations(locale, slug, title, summary, content_html)`;

  // Try master slug first (English source-of-truth)
  const { data: byMaster } = await supabase
    .from("news")
    .select(baseSelect)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle<ArticleRow>();
  if (byMaster) return { article: byMaster, urlLocale: null };

  // Fall back to translation slug lookup
  const { data: tr } = await supabase
    .from("news_translations")
    .select("news_id, locale")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle<{ news_id: string; locale: string }>();
  if (!tr) return null;

  const { data: byId } = await supabase
    .from("news")
    .select(baseSelect)
    .eq("status", "published")
    .eq("id", tr.news_id)
    .maybeSingle<ArticleRow>();
  if (!byId) return null;
  return { article: byId, urlLocale: tr.locale };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const match = await findArticleBySlug(slug);
  if (!match) return { title: "Article not found" };

  const { article, urlLocale } = match;
  const cookieLocale = await getLocale();
  // URL slug pins the locale; cookie only kicks in when URL is the master slug.
  const effectiveLocale = urlLocale ?? cookieLocale;
  const translation = article.translations?.find((t) => t.locale === effectiveLocale);
  const title = translation?.title ?? article.title;
  const summary = translation?.summary ?? article.summary;
  return {
    title: `${title} — [REDACTED]`,
    description: summary ?? undefined,
  };
}

export default async function NewsArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const match = await findArticleBySlug(slug);
  if (!match) notFound();

  const { article, urlLocale } = match;
  const cookieLocale = await getLocale();
  const effectiveLocale = urlLocale ?? cookieLocale;
  const translation = article.translations?.find((t) => t.locale === effectiveLocale);

  const display = {
    title: translation?.title ?? article.title,
    summary: translation?.summary ?? article.summary,
    content_html: translation?.content_html ?? article.content_html,
  };

  // "Also available" includes every other locale we have, plus the English
  // master if we're not already on it.
  const otherLocales: { locale: string; slug: string }[] = [];
  if (effectiveLocale !== "en") {
    otherLocales.push({ locale: "en", slug: article.slug });
  }
  for (const t of article.translations ?? []) {
    if (t.locale !== effectiveLocale && isSupportedLocale(t.locale)) {
      otherLocales.push({ locale: t.locale, slug: t.slug });
    }
  }

  const dateLocale = effectiveLocale === "zh-CN" ? "zh-CN" : "en-US";
  const publishDate = new Date(
    article.published_at ?? article.created_at
  ).toLocaleDateString(dateLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Only show the fallback notice when the user's UI locale (cookie) couldn't
  // be satisfied and we silently fell back to English. When the URL itself is
  // an English master slug for a zh-CN user there is nothing to fall back to.
  const isFallback = !translation && effectiveLocale !== "en";

  return (
    <div className="bg-background text-foreground min-h-screen">
      <article className="mx-auto max-w-3xl px-6 py-16 space-y-8">
        {/* Back */}
        <Link
          href="/news"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "text-muted-foreground hover:text-foreground -ml-2"
          )}
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          All news
        </Link>

        {/* Header */}
        <header className="space-y-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {publishDate}
            {isFallback && (
              <span className="ml-2 italic">
                · English (no {effectiveLocale} translation yet)
              </span>
            )}
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
            {display.title}
          </h1>
          {display.summary && (
            <p className="text-muted-foreground text-base leading-relaxed border-l-2 border-[color:var(--gold)] pl-4">
              {display.summary}
            </p>
          )}

          {otherLocales.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Also available:</span>
              {otherLocales.map((o) => (
                <Link
                  key={o.locale}
                  href={`/news/${o.slug}`}
                  className="rounded-md border border-border px-2 py-0.5 hover:border-[color:var(--gold)]/50 font-mono"
                >
                  {o.locale}
                </Link>
              ))}
            </div>
          )}
        </header>

        {/* Cover image */}
        {article.cover_image_url && (
          <div className="relative aspect-video rounded-xl overflow-hidden border border-border">
            <Image
              src={article.cover_image_url}
              alt={display.title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        )}

        {/* Content */}
        {display.content_html ? (
          <div
            className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground/85 prose-a:text-[color:var(--gold)] prose-strong:text-foreground"
            dangerouslySetInnerHTML={{ __html: display.content_html }}
          />
        ) : (
          <p className="text-muted-foreground italic">
            Full article content not available.
          </p>
        )}

        {/* Source link */}
        {article.source_url && (
          <div className="border-t border-border pt-6">
            <p className="text-xs text-muted-foreground">
              Source:{" "}
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[color:var(--gold)] hover:underline"
              >
                {article.source_name ?? article.source_url}
              </a>
            </p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              Summaries on this page may be AI-generated. Always follow the
              source link above for the original reporting.
            </p>
          </div>
        )}

        {/* Back button */}
        <div className="pt-4">
          <Link
            href="/news"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            Back to all news
          </Link>
        </div>
      </article>
    </div>
  );
}
