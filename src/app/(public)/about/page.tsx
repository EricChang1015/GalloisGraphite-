export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 space-y-6">
      <h1 className="text-3xl font-semibold">About Mada Graphite</h1>
      <p className="text-muted-foreground">
        Mada Graphite is the global trading platform for Graphite Energy Inc.,
        the operating arm of Etablissements Gallois S.A.&apos;s natural flake
        graphite mine in Madagascar.
      </p>
      <p className="text-sm text-muted-foreground">
        Full content TBD — see <code>docs/LEGACY_CONTENT.md</code> for the
        source material to be migrated here.
      </p>
    </div>
  );
}
