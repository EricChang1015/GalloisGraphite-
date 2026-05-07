import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <Link
          href="/"
          className="block text-center text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground"
        >
          Mada Graphite
        </Link>
        {children}
      </div>
    </div>
  );
}
