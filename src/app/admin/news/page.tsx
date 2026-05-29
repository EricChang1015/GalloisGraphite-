import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  NewsFormDialog,
  FetchNewsButton,
} from "@/components/admin/NewsActions";
import { NewsAdminTabs } from "@/components/admin/NewsAdminTabs";
import type { AdminNewsRow } from "@/components/admin/NewsArticleViews";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: `${t("meta.news")} — Mada Graphite` };
}

const STATUS_TAB_VALUES = ["pending", "published", "rejected", "draft"] as const;

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const t = await getTranslations("admin");
  const params = (await searchParams) ?? {};
  const activeTab =
    STATUS_TAB_VALUES.find((v) => v === params.tab) ?? "pending";

  const admin = createAdminClient();

  const { data: articles } = await admin
    .from("news")
    .select(
      `id, title, slug, summary, content_html, cover_image_url, source_url, source_name,
       status, relevance_score, rejected_reason, is_published, published_at, fetched_at, created_at,
       translations:news_translations(locale, slug)`
    )
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<AdminNewsRow[]>();

  const list = articles ?? [];

  const counts = {
    pending: list.filter((a) => a.status === "pending").length,
    published: list.filter((a) => a.status === "published").length,
    rejected: list.filter((a) => a.status === "rejected").length,
    draft: list.filter((a) => a.status === "draft").length,
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="sticky top-0 z-10 -mx-4 space-y-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">{t("news.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground md:block">
            <span className="hidden sm:inline">{t("news.subtitleDesktop")}</span>
            <span className="sm:hidden">{t("news.subtitleMobile")}</span>
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:flex-wrap">
          <NewsFormDialog className="w-full sm:w-auto" />
          <FetchNewsButton className="w-full sm:w-auto" />
        </div>
      </div>

      <Suspense fallback={null}>
        <NewsAdminTabs activeTab={activeTab} counts={counts} articles={list} />
      </Suspense>
    </div>
  );
}
