"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewsArticleViews, type AdminNewsRow } from "@/components/admin/NewsArticleViews";

const STATUS_TAB_VALUES = ["pending", "published", "rejected", "draft"] as const;

type TabValue = (typeof STATUS_TAB_VALUES)[number];

export function NewsAdminTabs({
  activeTab,
  counts,
  articles,
}: {
  activeTab: TabValue;
  counts: Record<TabValue, number>;
  articles: AdminNewsRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("admin");

  const tabs: { value: TabValue; label: string; shortLabel: string }[] = [
    { value: "pending", label: t("news.tabs.pending"), shortLabel: t("news.tabs.pendingShort") },
    { value: "published", label: t("news.tabs.published"), shortLabel: t("news.tabs.published") },
    { value: "rejected", label: t("news.tabs.rejected"), shortLabel: t("news.tabs.rejected") },
    { value: "draft", label: t("news.tabs.drafts"), shortLabel: t("news.tabs.drafts") },
  ];

  function onTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "pending") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-4">
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <TabsList className="h-auto w-max min-w-full flex-nowrap gap-1 p-1 md:w-fit md:min-w-0">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="shrink-0 px-2.5 text-xs sm:px-3 sm:text-sm">
              <span className="md:hidden">{tab.shortLabel}</span>
              <span className="hidden md:inline">{tab.label}</span>
              <span className="ml-1 text-xs text-muted-foreground">({counts[tab.value]})</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="space-y-3">
          <NewsArticleViews rows={articles.filter((a) => a.status === tab.value)} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
