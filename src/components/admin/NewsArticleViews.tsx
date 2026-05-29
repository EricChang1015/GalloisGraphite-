import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewsRowActions } from "@/components/admin/NewsActions";
import { cn } from "@/lib/utils";

export type AdminNewsRow = {
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

function articlePayload(row: AdminNewsRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    content_html: row.content_html,
    cover_image_url: row.cover_image_url,
    status: row.status,
    is_published: row.is_published,
    translations: row.translations ?? [],
  };
}

function NewsEmptyState() {
  return (
    <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      Nothing here yet.
    </div>
  );
}

export function NewsStatusBadge({ status }: { status: AdminNewsRow["status"] }) {
  const style: Record<AdminNewsRow["status"], string> = {
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

function TranslationBadges({ translations }: { translations: AdminNewsRow["translations"] }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="outline" className="text-[10px] font-mono">
        en
      </Badge>
      {(translations ?? []).map((t) => (
        <Badge key={t.locale} variant="outline" className="text-[10px] font-mono">
          {t.locale}
        </Badge>
      ))}
    </div>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SourceLink({ row }: { row: AdminNewsRow }) {
  if (!row.source_url) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <a
      href={row.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[color:var(--gold)] hover:underline break-all"
    >
      {row.source_name ?? hostnameOf(row.source_url)}
    </a>
  );
}

/** Desktop / landscape table — hidden below md. */
export function NewsArticleTable({ rows }: { rows: AdminNewsRow[] }) {
  if (rows.length === 0) return <NewsEmptyState />;

  return (
    <div className="hidden rounded-md border overflow-x-auto md:block">
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
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-md align-top">
                <div className="font-medium truncate">{row.title}</div>
                {row.summary && (
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {row.summary}
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground/70 font-mono mt-1">
                  /{row.slug}
                </div>
                {row.rejected_reason && (
                  <div className="text-xs text-red-400 mt-1">
                    Reason: {row.rejected_reason}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-xs align-top">
                <SourceLink row={row} />
              </TableCell>
              <TableCell className="text-xs align-top">
                {row.relevance_score !== null ? row.relevance_score.toFixed(2) : "—"}
              </TableCell>
              <TableCell className="align-top">
                <NewsStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="align-top">
                <TranslationBadges translations={row.translations} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground align-top">
                {new Date(row.fetched_at ?? row.created_at).toLocaleString()}
              </TableCell>
              <TableCell className="text-right align-top">
                <NewsRowActions article={articlePayload(row)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Portrait / mobile card stack — visible below md only. */
export function NewsArticleCardList({ rows }: { rows: AdminNewsRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="md:hidden">
        <NewsEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-3 md:hidden">
      {rows.map((row) => (
        <Card key={row.id} size="sm" className="ring-border/60">
          <CardHeader className="gap-2 border-b border-border pb-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-sm leading-snug">{row.title}</CardTitle>
              <NewsStatusBadge status={row.status} />
            </div>
            {row.summary && (
              <p className="text-xs text-muted-foreground line-clamp-3">{row.summary}</p>
            )}
            <p className="text-[10px] font-mono text-muted-foreground/70">/{row.slug}</p>
            {row.rejected_reason && (
              <p className="text-xs text-red-400">Reason: {row.rejected_reason}</p>
            )}
          </CardHeader>

          <CardContent className="space-y-3 pt-0">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Source</dt>
                <dd className="mt-0.5">
                  <SourceLink row={row} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Score</dt>
                <dd className="mt-0.5">
                  {row.relevance_score !== null ? row.relevance_score.toFixed(2) : "—"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Translations</dt>
                <dd className="mt-1">
                  <TranslationBadges translations={row.translations} />
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Fetched / Created</dt>
                <dd className="mt-0.5 text-muted-foreground">
                  {new Date(row.fetched_at ?? row.created_at).toLocaleString()}
                </dd>
              </div>
            </dl>
          </CardContent>

          <CardFooter className={cn("flex-col items-stretch gap-2 bg-transparent")}>
            <NewsRowActions article={articlePayload(row)} compact />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export function NewsArticleViews({ rows }: { rows: AdminNewsRow[] }) {
  return (
    <>
      <NewsArticleCardList rows={rows} />
      <NewsArticleTable rows={rows} />
    </>
  );
}
