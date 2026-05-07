export const metadata = { title: "Order detail" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Order {id}</h1>
      <p className="text-sm text-muted-foreground">
        Tabs: Overview / Contract / Payment / Shipment / Receipt / Chat.
      </p>
    </div>
  );
}
