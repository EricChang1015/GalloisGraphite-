import { UserAvatar } from "@/components/profile/UserAvatar";
import {
  counterpartyLabel,
  type CounterpartyProfile,
} from "@/lib/chat/display";
import { cn } from "@/lib/utils";

interface Props {
  profile: CounterpartyProfile;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
}

export function CounterpartyCard({ profile, subtitle, className, children }: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card/50 p-3",
        className
      )}
    >
      <UserAvatar profile={profile} size="lg" enlargeable />
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{counterpartyLabel(profile)}</p>
        <p className="text-xs text-muted-foreground truncate">
          {subtitle ?? profile.country ?? "—"}
        </p>
      </div>
      {children}
    </div>
  );
}
