export const metadata = { title: "News" };

export default function NewsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 space-y-6">
      <h1 className="text-3xl font-semibold">News</h1>
      <p className="text-muted-foreground">
        Latest graphite industry news, curated by the platform editors. TODO:
        wire up to <code>news</code> table.
      </p>
    </div>
  );
}
