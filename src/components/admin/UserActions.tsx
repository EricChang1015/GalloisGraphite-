"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { SnowflakeIcon, SunIcon } from "lucide-react";

import { freezeUser, unfreezeUser, setUserRole } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface UserActionsProps {
  userId: string;
  currentRole: string;
  currentStatus: string;
}

const ASSIGNABLE_ROLES = ["buyer", "seller", "admin"] as const;

export function UserActions({ userId, currentRole, currentStatus }: UserActionsProps) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tEnums = useTranslations("enums");
  const [isPending, startTransition] = useTransition();

  function handleFreeze() {
    startTransition(async () => {
      const result = await freezeUser({ user_id: userId, reason: "Admin action" });
      if (result.error) { toast.error(result.error.message); return; }
      toast.success(t("users.actions.frozen"));
      router.refresh();
    });
  }

  function handleUnfreeze() {
    startTransition(async () => {
      const result = await unfreezeUser(userId);
      if (result.error) { toast.error(result.error.message); return; }
      toast.success(t("users.actions.reactivated"));
      router.refresh();
    });
  }

  function handleRoleChange(role: string | null) {
    if (!role) return;
    startTransition(async () => {
      const result = await setUserRole({ user_id: userId, role: role as "buyer" | "seller" | "admin" });
      if (result.error) { toast.error(result.error.message); return; }
      toast.success(t("users.actions.roleUpdated", { role: tEnums(`role.${role as "buyer" | "seller" | "admin"}`) }));
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select defaultValue={currentRole} onValueChange={handleRoleChange} disabled={isPending}>
        <SelectTrigger className="h-7 text-xs w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ASSIGNABLE_ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {tEnums(`role.${role}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {currentStatus === "frozen" ? (
        <Button size="sm" variant="outline" onClick={handleUnfreeze} disabled={isPending} className="h-7 text-xs">
          <SunIcon className="w-3 h-3 mr-1" />
          {t("users.actions.unfreeze")}
        </Button>
      ) : (
        <Button size="sm" variant="destructive" onClick={handleFreeze} disabled={isPending} className="h-7 text-xs">
          <SnowflakeIcon className="w-3 h-3 mr-1" />
          {t("users.actions.freeze")}
        </Button>
      )}
    </div>
  );
}
