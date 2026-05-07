import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "My Listings" };

export default function MyListingsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Listings</h1>
        <Link href="/listings/new" className={cn(buttonVariants())}>
          + New listing
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Sellers manage their listings here. TODO: render a table from
        <code> listings</code>.
      </p>
    </div>
  );
}
