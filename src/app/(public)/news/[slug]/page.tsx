import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("news")
    .select("title, summary")
    .eq("slug", slug)
    .eq("is_published", true)
    .single<{ title: string; summary: string | null }>();

  if (!data) return { title: "Article not found" };
  return {
    title: `${data.title} — Mada Graphite`,
    description: data.summary ?? undefined,
  };
}

export default async function NewsArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createServerClient();

  const { data: article } = await supabase
    .from("news")
    .select(
      "id, title, slug, summary, content_html, cover_image_url, source_url, published_at, created_at"
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .single<{
      id: string;
      title: string;
      slug: string;
      summary: string | null;
      content_html: string | null;
      cover_image_url: string | null;
      source_url: string | null;
      published_at: string | null;
      created_at: string;
    }>();

  if (!article) notFound();

  const publishDate = new Date(
    article.published_at ?? article.created_at
  ).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="bg-neutral-950 text-neutral-100 min-h-screen">
      <article className="mx-auto max-w-3xl px-6 py-16 space-y-8">
        {/* Back */}
        <Link
          href="/news"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "text-neutral-400 hover:text-neutral-100 -ml-2"
          )}
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          All news
        </Link>

        {/* Header */}
        <header className="space-y-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">
            {publishDate}
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
            {article.title}
          </h1>
          {article.summary && (
            <p className="text-neutral-400 text-base leading-relaxed border-l-2 border-[color:var(--gold)] pl-4">
              {article.summary}
            </p>
          )}
        </header>

        {/* Cover image */}
        {article.cover_image_url && (
          <div className="relative aspect-video rounded-xl overflow-hidden border border-neutral-800">
            <Image
              src={article.cover_image_url}
              alt={article.title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        )}

        {/* Content */}
        {article.content_html ? (
          <div
            className="prose prose-invert prose-sm max-w-none prose-headings:text-neutral-100 prose-p:text-neutral-300 prose-a:text-[color:var(--gold)] prose-strong:text-neutral-100"
            dangerouslySetInnerHTML={{ __html: article.content_html }}
          />
        ) : (
          <p className="text-neutral-500 italic">
            Full article content not available.
          </p>
        )}

        {/* Source link */}
        {article.source_url && (
          <div className="border-t border-neutral-800 pt-6">
            <p className="text-xs text-neutral-500">
              Source:{" "}
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[color:var(--gold)] hover:underline"
              >
                {article.source_url}
              </a>
            </p>
          </div>
        )}

        {/* Back button */}
        <div className="pt-4">
          <Link
            href="/news"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-neutral-700 text-neutral-300")}
          >
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            Back to all news
          </Link>
        </div>
      </article>
    </div>
  );
}
