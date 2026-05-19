import Link from "next/link";

import { AiChatLauncher } from "@/components/chat/AiChatLauncher";
import { Navbar } from "@/components/layout/Navbar";
import { Badge } from "@/components/ui/badge";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import {
  getUserActionCounts,
  type UserActionCounts,
} from "@/lib/notifications/counts";

const NAV: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/market", label: "Market" },
  { href: "/listings", label: "My Listings" },
  { href: "/inquiries", label: "Inquiries" },
  { href: "/orders", label: "Orders" },
  { href: "/messages", label: "Messages" },
  { href: "/settings", label: "Settings" },
];

// User counts can change after any server-action mutation that calls
// `revalidatePath('/dashboard')` (or similar). The layout itself doesn't
// pin a revalidation target, but Next.js will re-render on each request
// because the count helpers read auth cookies via the SSR client.
function badgeFor(
  href: string,
  counts: UserActionCounts | null
): React.ReactNode {
  if (!counts) return null;
  switch (href) {
    case "/inquiries":
      return counts.inquiriesNeedingMyResponse > 0 ? (
        <Badge
          variant="outline"
          className="ml-auto h-5 min-w-5 px-1.5 border-[color:var(--gold)]/40 text-[color:var(--gold)]"
        >
          {counts.inquiriesNeedingMyResponse}
        </Badge>
      ) : null;
    case "/orders":
      return counts.ordersNeedingMyAction > 0 || counts.ordersDisputed > 0 ? (
        <span className="ml-auto inline-flex items-center gap-1">
          {counts.ordersNeedingMyAction > 0 && (
            <Badge
              variant="outline"
              className="h-5 min-w-5 px-1.5 border-[color:var(--gold)]/40 text-[color:var(--gold)]"
            >
              {counts.ordersNeedingMyAction}
            </Badge>
          )}
          {counts.ordersDisputed > 0 && (
            <Badge
              variant="destructive"
              className="h-5 min-w-5 px-1.5"
              title="Disputed orders need attention"
            >
              !
            </Badge>
          )}
        </span>
      ) : null;
    case "/settings":
      return counts.profileIncomplete ? (
        <span
          className="ml-auto inline-block size-2 rounded-full bg-destructive"
          aria-label="Profile incomplete"
          title="Complete your commercial profile"
        />
      ) : null;
    default:
      return null;
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  // Layout is rendered under middleware-protected routes, so a missing user
  // shouldn't happen — but if it does (e.g. session expired mid-render),
  // skip the count round-trip entirely to keep the layout cheap.
  const counts =
    user && profile ? await getUserActionCounts(user.id, profile.role) : null;

  return (
    <>
      <Navbar />
      <div className="flex flex-1">
        <aside className="hidden md:flex md:w-56 flex-col border-r border-border bg-card">
          <div className="px-4 py-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Workspace
          </div>
          <nav className="flex flex-col px-2 py-2 gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <span>{item.label}</span>
                {badgeFor(item.href, counts)}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </div>
      <AiChatLauncher />
    </>
  );
}
