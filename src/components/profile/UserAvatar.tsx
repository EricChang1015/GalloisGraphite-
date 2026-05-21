import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  profileInitials,
  type CounterpartyProfile,
} from "@/lib/chat/display";
import type { AvatarProfileFields } from "@/lib/profile/avatar";

type Props = {
  profile: AvatarProfileFields | CounterpartyProfile;
  size?: "default" | "sm" | "lg";
  className?: string;
};

export function UserAvatar({ profile, size = "default", className }: Props) {
  const avatarUrl =
    "avatar_url" in profile ? profile.avatar_url?.trim() || null : null;

  return (
    <Avatar size={size} className={className}>
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt="" />
      ) : null}
      <AvatarFallback className="bg-primary/15 text-primary font-medium">
        {profileInitials(profile as CounterpartyProfile)}
      </AvatarFallback>
    </Avatar>
  );
}
