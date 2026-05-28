import { Suspense } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  NewsFormDialog,
  FetchNewsButton,
} from "@/components/admin/NewsActions";
import { NewsAdminTabs } from "@/components/admin/NewsAdminTabs";
import type { AdminNewsRow } from "@/components/admin/NewsArticleViews";

export const metadata = { title: "Admin · News" };

const STATUS_TABS = [
  { value: "pending", label: "Pending review" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Drafts" },
] as const;

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const activeTab =
    STATUS_TABS.find((t) => t.value === params.tab)?.value ?? "pending";

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
          <h1 className="text-xl font-semibold md:text-2xl">News Articles</h1>
          <p className="mt-1 text-sm text-muted-foreground md:block">
            <span className="hidden sm:inline">
              Aggregate, review and publish graphite industry news. Use the
              <span className="text-foreground"> Fetch latest news</span> button
              to pull fresh candidates from the LLM (no DB writes until you
              confirm).
            </span>
            <span className="sm:hidden">
              Review, fetch, and publish industry news.
            </span>
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
