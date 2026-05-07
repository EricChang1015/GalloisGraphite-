export const metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Orders</h1>
      <p className="text-sm text-muted-foreground">
        Both buyer and seller see their orders here. Click into one for the
        full state machine, contract, payment, shipment, and chat tabs.
      </p>
    </div>
  );
}
