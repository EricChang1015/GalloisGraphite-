"use client";

import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarLightbox } from "@/components/profile/AvatarLightbox";
import {
  profileInitials,
  type CounterpartyProfile,
} from "@/lib/chat/display";
import type { AvatarProfileFields } from "@/lib/profile/avatar";
import { cn } from "@/lib/utils";

type Props = {
  profile: AvatarProfileFields | CounterpartyProfile;
  size?: "default" | "sm" | "lg";
  className?: string;
  /** When true and an image URL exists, clicking opens a larger preview. */
  enlargeable?: boolean;
};

export function UserAvatar({
  profile,
  size = "default",
  className,
  enlargeable = false,
}: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const avatarUrl =
    "avatar_url" in profile ? profile.avatar_url?.trim() || null : null;
  const canEnlarge = enlargeable && Boolean(avatarUrl);

  const avatarNode = (
    <Avatar size={size} className={className}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className="bg-primary/15 text-primary font-medium">
        {profileInitials(profile as CounterpartyProfile)}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <>
      {canEnlarge ? (
        <button
          type="button"
          className={cn(
            "rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
          aria-label="View profile photo"
          onClick={() => setLightboxOpen(true)}
        >
          {avatarNode}
        </button>
      ) : (
        avatarNode
      )}
      {canEnlarge && avatarUrl ? (
        <AvatarLightbox
          imageUrl={avatarUrl}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      ) : null}
    </>
  );
}
