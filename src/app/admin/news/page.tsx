import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  NewsFormDialog,
  NewsRowActions,
  FetchNewsButton,
} from "@/components/admin/NewsActions";

export const metadata = { title: "Admin · News" };

type NewsRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content_html: string | null;
  cover_image_url: string | null;
  source_url: string | null;
  source_name: string | null;
  status: "draft" | "pending" | "approved" | "published" | "rejected";
  relevance_score: number | null;
  rejected_reason: string | null;
  is_published: boolean;
  published_at: string | null;
  fetched_at: string | null;
  created_at: string;
  translations: { locale: string; slug: string }[] | null;
};

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
  const activeTab = STATUS_TABS.find((t) => t.value === params.tab)?.value ?? "pending";

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
    .returns<NewsRow[]>();

  const list = articles ?? [];

  const counts = {
    pending: list.filter((a) => a.status === "pending").length,
    published: list.filter((a) => a.status === "published").length,
    rejected: list.filter((a) => a.status === "rejected").length,
    draft: list.filter((a) => a.status === "draft").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">News Articles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aggregate, review and publish graphite industry news. Use the
            <span className="text-foreground"> Fetch latest news</span> button
            to pull fresh candidates from the LLM (no DB writes until you
            confirm).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewsFormDialog />
          <FetchNewsButton />
        </div>
      </div>

      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({counts[tab.value]})
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUS_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="space-y-3">
            <NewsTable rows={list.filter((a) => a.status === tab.value)} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function NewsTable({ rows }: { rows: NewsRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Nothing here yet.
      </div>
    );
  }
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Translations</TableHead>
            <TableHead>Fetched / Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="max-w-md align-top">
                <div className="font-medium truncate">{a.title}</div>
                {a.summary && (
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {a.summary}
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground/70 font-mono mt-1">
                  /{a.slug}
                </div>
                {a.rejected_reason && (
                  <div className="text-xs text-red-400 mt-1">
                    Reason: {a.rejected_reason}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-xs align-top">
                {a.source_url ? (
                  <a
                    href={a.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[color:var(--gold)] hover:underline break-all"
                  >
                    {a.source_name ?? hostnameOf(a.source_url)}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-xs align-top">
                {a.relevance_score !== null
                  ? a.relevance_score.toFixed(2)
                  : "—"}
              </TableCell>
              <TableCell className="align-top">
                <StatusBadge status={a.status} />
              </TableCell>
              <TableCell className="align-top">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px] font-mono">en</Badge>
                  {(a.translations ?? []).map((t) => (
                    <Badge key={t.locale} variant="outline" className="text-[10px] font-mono">
                      {t.locale}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground align-top">
                {new Date(a.fetched_at ?? a.created_at).toLocaleString()}
              </TableCell>
              <TableCell className="text-right align-top">
                <NewsRowActions
                  article={{
                    id: a.id,
                    title: a.title,
                    slug: a.slug,
                    summary: a.summary,
                    content_html: a.content_html,
                    cover_image_url: a.cover_image_url,
                    status: a.status,
                    is_published: a.is_published,
                    translations: a.translations ?? [],
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusBadge({ status }: { status: NewsRow["status"] }) {
  const style: Record<NewsRow["status"], string> = {
    draft: "text-muted-foreground",
    pending: "text-[color:var(--gold)] border-[color:var(--gold)]/40",
    approved: "text-blue-400 border-blue-400/40",
    published: "text-green-400 border-green-400/40",
    rejected: "text-red-400 border-red-400/40",
  };
  return (
    <Badge variant="outline" className={style[status]}>
      {status}
    </Badge>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
