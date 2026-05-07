export const metadata = { title: "Admin · Users" };

export default function AdminUsersPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="text-sm text-muted-foreground">
        Search / paginate users. Toggle status (freeze / unfreeze) and roles.
      </p>
    </div>
  );
}
