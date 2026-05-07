export const metadata = { title: "Admin · News" };

export default function AdminNewsPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">News</h1>
      <p className="text-sm text-muted-foreground">
        Create / edit / publish news posts. Drafts are hidden from the public
        site.
      </p>
    </div>
  );
}
