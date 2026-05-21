"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  imageUrl: string;
  label?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AvatarLightbox({
  imageUrl,
  label = "Profile photo",
  open,
  onOpenChange,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md border-none bg-transparent p-2 shadow-none ring-0 sm:max-w-lg"
        showCloseButton
      >
        <DialogTitle className="sr-only">{label}</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={label}
          className="mx-auto max-h-[min(70vh,500px)] w-auto max-w-full rounded-xl object-contain ring-1 ring-border"
        />
      </DialogContent>
    </Dialog>
  );
}
