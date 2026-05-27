import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AiChatLauncher } from "@/components/chat/AiChatLauncher";
import { Navbar } from "@/components/layout/Navbar";
import type { WorkspaceMobileSection } from "@/components/layout/MobileNav";
import { Badge } from "@/components/ui/badge";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import {
  getUserActionCounts,
  type UserActionCounts,
} from "@/lib/notifications/counts";

type NavKey =
  | "dashboard"
  | "market"
  | "myListings"
  | "inquiries"
  | "orders"
  | "messages"
  | "settings";

const NAV: { href: string; key: NavKey }[] = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/market", key: "market" },
  { href: "/listings", key: "myListings" },
  { href: "/inquiries", key: "inquiries" },
  { href: "/orders", key: "orders" },
  { href: "/messages", key: "messages" },
  { href: "/settings", key: "settings" },
];

// User counts can change after any server-action mutation that calls
// `revalidatePath('/dashboard')` (or similar). The layout itself doesn't
// pin a revalidation target, but Next.js will re-render on each request
// because the count helpers read auth cookies via the SSR client.
function badgeFor(
  href: string,
  counts: UserActionCounts | null,
  labels: { disputedTitle: string; profileIncomplete: string }
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
              title={labels.disputedTitle}
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
          aria-label={labels.profileIncomplete}
          title={labels.profileIncomplete}
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
  const [user, profile, tNav] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
    getTranslations("nav"),
  ]);

  const counts =
    user && profile ? await getUserActionCounts(user.id, profile.role) : null;

  const badgeLabels = {
    disputedTitle: tNav("badges.disputedOrders"),
    profileIncomplete: tNav("badges.profileIncomplete"),
  };

  const workspaceLabel = tNav("workspace");

  const workspace: WorkspaceMobileSection = {
    label: workspaceLabel,
    items: NAV.map((item) => ({
      href: item.href,
      label: tNav(`items.${item.key}`),
      badge: badgeFor(item.href, counts, badgeLabels),
    })),
  };

  return (
    <>
      <Navbar workspace={workspace} />
      <div className="flex flex-1">
        <aside className="hidden md:flex md:w-56 flex-col border-r border-border bg-card">
          <div className="px-4 py-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {workspaceLabel}
          </div>
          <nav className="flex flex-col px-2 py-2 gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <span>{tNav(`items.${item.key}`)}</span>
                {badgeFor(item.href, counts, badgeLabels)}
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
