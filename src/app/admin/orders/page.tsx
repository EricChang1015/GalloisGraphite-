export const metadata = { title: "Admin · Orders" };

export default function AdminOrdersPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">All orders</h1>
      <p className="text-sm text-muted-foreground">
        Platform-wide order overview. Admin can intervene in stuck orders.
      </p>
    </div>
  );
}
