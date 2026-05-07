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
import { NewsFormDialog } from "@/components/admin/NewsActions";

export const metadata = { title: "Admin · News" };

export default async function AdminNewsPage() {
  const admin = createAdminClient();

  const { data: articles } = await admin
    .from("news")
    .select("id, title, slug, summary, content_html, cover_image_url, is_published, published_at, created_at")
    .order("created_at", { ascending: false })
    .returns<{
      id: string;
      title: string;
      slug: string;
      summary: string | null;
      content_html: string | null;
      cover_image_url: string | null;
      is_published: boolean;
      published_at: string | null;
      created_at: string;
    }[]>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">News Articles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and publish news articles visible on the public site.
          </p>
        </div>
        <NewsFormDialog />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(articles ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium max-w-xs truncate">{a.title}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">{a.slug}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={a.is_published ? "text-green-400 border-green-400/40" : "text-muted-foreground"}
                  >
                    {a.is_published ? "published" : "draft"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {a.published_at ? new Date(a.published_at).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <NewsFormDialog existing={a} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
