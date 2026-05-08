import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "News — Mada Graphite",
  description:
    "Latest graphite industry news, market updates and company announcements from Mada Graphite.",
};

export const revalidate = 300; // ISR: re-fetch every 5 minutes

export default async function NewsPage() {
  const supabase = await createServerClient();

  const { data: articles } = await supabase
    .from("news")
    .select(
      "id, title, slug, summary, cover_image_url, published_at, created_at"
    )
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .returns<
      {
        id: string;
        title: string;
        slug: string;
        summary: string | null;
        cover_image_url: string | null;
        published_at: string | null;
        created_at: string;
      }[]
    >();

  const list = articles ?? [];

  return (
    <div className="bg-neutral-950 text-neutral-100 min-h-screen">
      {/* Header */}
      <section className="mx-auto max-w-5xl px-6 py-16 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--gold)]">
          Industry Updates
        </p>
        <h1 className="text-4xl font-semibold">News</h1>
        <p className="text-neutral-400 text-sm max-w-xl">
          Latest graphite industry news, market intelligence and company
          announcements, curated by the Mada Graphite team.
        </p>
      </section>

      {/* Articles */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        {list.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 border-dashed p-20 text-center space-y-2">
            <p className="text-neutral-500">No published articles yet.</p>
            <p className="text-xs text-neutral-600">
              Check back soon — our editorial team publishes regularly.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((article) => (
              <Link
                key={article.id}
                href={`/news/${article.slug}`}
                className="group block rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden hover:border-neutral-600 transition-colors"
              >
                {article.cover_image_url ? (
                  <div className="relative aspect-video overflow-hidden">
                    <Image
                      src={article.cover_image_url}
                      alt={article.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-neutral-800 flex items-center justify-center">
                    <span className="text-xs text-neutral-600 uppercase tracking-wider">
                      Mada Graphite
                    </span>
                  </div>
                )}
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[color:var(--gold)] border-[color:var(--gold)]/30 text-xs"
                    >
                      News
                    </Badge>
                    <span className="text-xs text-neutral-500">
                      {new Date(
                        article.published_at ?? article.created_at
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <h2 className="font-semibold text-sm leading-snug group-hover:text-[color:var(--gold)] transition-colors line-clamp-2">
                    {article.title}
                  </h2>
                  {article.summary && (
                    <p className="text-xs text-neutral-400 leading-relaxed line-clamp-3">
                      {article.summary}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
