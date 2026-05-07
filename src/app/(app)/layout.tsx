import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/market", label: "Market" },
  { href: "/listings", label: "My Listings" },
  { href: "/inquiries", label: "Inquiries" },
  { href: "/orders", label: "Orders" },
  { href: "/messages", label: "Messages" },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1">
      <aside className="hidden md:flex md:w-56 flex-col border-r border-border bg-card">
        <div className="px-4 py-4 text-sm font-semibold tracking-wide">
          Mada Graphite
        </div>
        <nav className="flex flex-col px-2 py-2 gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</div>
    </div>
  );
}
