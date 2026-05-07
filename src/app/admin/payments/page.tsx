export const metadata = { title: "Admin · Payments" };

export default function AdminPaymentsPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Payment verification</h1>
      <p className="text-sm text-muted-foreground">
        ⭐ Core admin workflow: review pending payments (tx_hash / proof) and
        mark them <strong>verified</strong> or <strong>rejected</strong>.
      </p>
    </div>
  );
}
