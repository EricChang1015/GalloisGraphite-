"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewsArticleViews, type AdminNewsRow } from "@/components/admin/NewsArticleViews";

const STATUS_TABS = [
  { value: "pending", label: "Pending review", shortLabel: "Pending" },
  { value: "published", label: "Published", shortLabel: "Published" },
  { value: "rejected", label: "Rejected", shortLabel: "Rejected" },
  { value: "draft", label: "Drafts", shortLabel: "Drafts" },
] as const;

type TabValue = (typeof STATUS_TABS)[number]["value"];

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
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="shrink-0 px-2.5 text-xs sm:px-3 sm:text-sm">
              <span className="md:hidden">{tab.shortLabel}</span>
              <span className="hidden md:inline">{tab.label}</span>
              <span className="ml-1 text-xs text-muted-foreground">({counts[tab.value]})</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {STATUS_TABS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="space-y-3">
          <NewsArticleViews rows={articles.filter((a) => a.status === tab.value)} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
