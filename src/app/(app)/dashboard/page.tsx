export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Personalized summary (active listings / open inquiries / orders in
        progress) goes here.
      </p>
    </div>
  );
}
