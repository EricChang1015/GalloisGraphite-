export const metadata = { title: "Inquiries" };

export default function InquiriesPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Inquiries</h1>
      <p className="text-sm text-muted-foreground">
        Buyers see their outgoing inquiries; sellers see incoming inquiries
        with accept / reject actions.
      </p>
    </div>
  );
}
