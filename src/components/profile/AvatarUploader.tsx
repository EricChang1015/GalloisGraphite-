"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { toast } from "sonner";

import { clearProfileAvatar, updateProfileAvatar } from "@/actions/profile";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  AVATAR_ALLOWED_MIME,
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  avatarObjectPath,
  avatarPublicUrl,
} from "@/lib/profile/avatar";
import { prepareAvatarUpload } from "@/lib/profile/resizeAvatarImage";
import type { AvatarProfileFields } from "@/lib/profile/avatar";

interface Props {
  userId: string;
  profile: AvatarProfileFields;
}

export function AvatarUploader({ userId, profile }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    profile.avatar_url ?? null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [, startTransition] = useTransition();

  async function handleFile(file: File) {
    if (!AVATAR_ALLOWED_MIME.includes(file.type as (typeof AVATAR_ALLOWED_MIME)[number])) {
      toast.error("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Image must be 2 MB or smaller.");
      return;
    }

    setIsUploading(true);
    try {
      const prepared = await prepareAvatarUpload(file);
      const supabase = createClient();
      const path = avatarObjectPath(userId, prepared.name);

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, prepared, { cacheControl: "3600", upsert: true });

      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        return;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        toast.error("Storage is not configured.");
        return;
      }

      const publicUrl = avatarPublicUrl(supabaseUrl, path);

      startTransition(async () => {
        const result = await updateProfileAvatar(publicUrl);
        if (result.error) {
          toast.error(result.error.message);
        } else {
          setPreviewUrl(publicUrl);
          toast.success("Profile photo updated.");
          router.refresh();
        }
        setIsUploading(false);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload error.";
      toast.error(message);
      setIsUploading(false);
    }
  }

  async function handleRemove() {
    startTransition(async () => {
      const result = await clearProfileAvatar();
      if (result.error) {
        toast.error(result.error.message);
      } else {
        setPreviewUrl(null);
        toast.success("Profile photo removed.");
        router.refresh();
      }
    });
  }

  const displayProfile: AvatarProfileFields = {
    ...profile,
    avatar_url: previewUrl,
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative shrink-0">
        <UserAvatar
          profile={displayProfile}
          size="lg"
          className="size-20"
          enlargeable
        />
        <button
          type="button"
          className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-muted"
          aria-label="Change profile photo"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="size-4" />
        </button>
      </div>
      <div className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          Upload a photo (JPEG, PNG, or WebP, max 2 MB). Images larger than
          500×500 are resized before saving. Google sign-in uses your Google
          picture until you replace it.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? "Uploading…" : "Upload photo"}
          </Button>
          {previewUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isUploading}
              onClick={handleRemove}
            >
              Remove
            </Button>
          ) : null}
        </div>
        <Input
          ref={inputRef}
          type="file"
          accept={AVATAR_ALLOWED_MIME.join(",")}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
