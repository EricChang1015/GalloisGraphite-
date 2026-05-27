"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
  className?: string;
  variant?: "ghost" | "outline";
  size?: "sm" | "lg";
};

export function LogoutButton({
  className,
  variant = "ghost",
  size = "sm",
}: LogoutButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");

  function onClick() {
    startTransition(async () => {
      const result = await signOut();
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={onClick}
      className={cn(size === "lg" && "w-full", className)}
    >
      {pending ? tCommon("actions.loading") : t("items.logOut")}
    </Button>
  );
}
