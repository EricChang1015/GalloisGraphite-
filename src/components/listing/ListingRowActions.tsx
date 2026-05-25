"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  PencilIcon,
  PauseIcon,
  PlayIcon,
  PackageXIcon,
  TrashIcon,
  Loader2Icon,
} from "lucide-react";

import {
  pauseListing,
  resumeListing,
  deleteListing,
  markListingSoldOut,
} from "@/actions/listing";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface ListingRowActionsProps {
  listing: {
    id: string;
    title: string;
    status: string;
  };
}

export function ListingRowActions({ listing }: ListingRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function run(fn: () => Promise<{ error: { message: string } | null }>, ok: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(ok);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        render={
          <Link
            href={`/listings/${listing.id}/edit`}
            aria-label="Edit listing"
          />
        }
      >
        <PencilIcon className="size-3 mr-1" /> Edit
      </Button>

      {listing.status === "active" ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          disabled={isPending}
          onClick={() =>
            run(() => pauseListing(listing.id), "Listing paused.")
          }
        >
          <PauseIcon className="size-3 mr-1" /> Pause
        </Button>
      ) : listing.status === "paused" ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-green-400"
          disabled={isPending}
          onClick={() =>
            run(() => resumeListing(listing.id), "Listing reactivated.")
          }
        >
          <PlayIcon className="size-3 mr-1" /> Resume
        </Button>
      ) : null}

      {listing.status !== "sold_out" && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          disabled={isPending}
          onClick={() =>
            run(
              () => markListingSoldOut(listing.id),
              "Marked as sold out."
            )
          }
          title="Mark this listing as sold out"
        >
          <PackageXIcon className="size-3 mr-1" /> Sold out
        </Button>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger
          render={
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-destructive hover:text-destructive"
              aria-label={`Delete listing ${listing.title}`}
            />
          }
        >
          {isPending ? (
            <Loader2Icon className="size-3 animate-spin" />
          ) : (
            <>
              <TrashIcon className="size-3 mr-1" /> Delete
            </>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this listing?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Permanently remove <strong>{listing.title}</strong>?
            </p>
            <p className="text-muted-foreground">
              If any orders reference this listing the delete will be refused
              — pause or mark it sold-out instead. Inquiries and quotations
              keep their history but lose the listing link.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await deleteListing(listing.id);
                    if (result.error) {
                      toast.error(result.error.message);
                      return;
                    }
                    toast.success("Listing deleted.");
                    setConfirmOpen(false);
                    router.refresh();
                  });
                }}
              >
                {isPending ? "Deleting…" : "Delete listing"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
