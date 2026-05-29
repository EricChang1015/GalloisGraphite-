"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  UserListAttentionFilter,
  UserListFilterParams,
  UserListKycFilter,
  UserListRoleFilter,
  UserListSort,
  UserListStatusFilter,
} from "@/lib/admin/user-list-filters";
import { hasActiveUserFilters } from "@/lib/admin/user-list-filters";

type Props = {
  needsActionCount: number;
  initialParams: Required<UserListFilterParams>;
};

export function AdminUsersToolbar({ needsActionCount, initialParams }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("admin");
  const tEnums = useTranslations("enums");

  const [searchValue, setSearchValue] = useState(initialParams.q);

  useEffect(() => {
    setSearchValue(initialParams.q);
  }, [initialParams.q]);

  const showClear = useMemo(
    () => hasActiveUserFilters(initialParams),
    [initialParams]
  );

  function pushParams(next: Partial<UserListFilterParams>) {
    const merged: Required<UserListFilterParams> = {
      ...initialParams,
      ...next,
    };
    const params = new URLSearchParams(searchParams.toString());

    const setOrDelete = (key: string, value: string, defaultValue: string) => {
      if (!value || value === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    };

    setOrDelete("q", merged.q.trim(), "");
    setOrDelete("attention", merged.attention, "all");
    setOrDelete("status", merged.status, "all");
    setOrDelete("role", merged.role, "all");
    setOrDelete("kyc", merged.kyc, "all");
    setOrDelete("sort", merged.sort, "attention");

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchValue === initialParams.q) return;
      pushParams({ q: searchValue });
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce only search input
  }, [searchValue]);

  function toggleNeedsAction() {
    const nextAttention: UserListAttentionFilter =
      initialParams.attention === "needs_action" ? "all" : "needs_action";
    pushParams({ attention: nextAttention });
  }

  function clearFilters() {
    setSearchValue("");
    router.push(pathname, { scroll: false });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={t("users.filters.searchPlaceholder")}
            className="pl-8"
            aria-label={t("users.filters.searchPlaceholder")}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant={initialParams.attention === "needs_action" ? "default" : "outline"}
          onClick={toggleNeedsAction}
          className={cn(
            "shrink-0",
            initialParams.attention !== "needs_action" &&
              needsActionCount > 0 &&
              "border-amber-400/40 text-amber-400"
          )}
        >
          {t("users.filters.needsAction")}
          {needsActionCount > 0 ? ` (${needsActionCount})` : ""}
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={initialParams.status}
          onValueChange={(value) =>
            pushParams({ status: value as UserListStatusFilter })
          }
        >
          <SelectTrigger className="h-8 w-full text-xs sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("users.filters.statusAll")}</SelectItem>
            <SelectItem value="active">
              {tEnums("accountStatus.active")}
            </SelectItem>
            <SelectItem value="pending">
              {tEnums("accountStatus.pending")}
            </SelectItem>
            <SelectItem value="frozen">
              {tEnums("accountStatus.frozen")}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={initialParams.role}
          onValueChange={(value) =>
            pushParams({ role: value as UserListRoleFilter })
          }
        >
          <SelectTrigger className="h-8 w-full text-xs sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("users.filters.roleAll")}</SelectItem>
            <SelectItem value="buyer">{tEnums("role.buyer")}</SelectItem>
            <SelectItem value="seller">{tEnums("role.seller")}</SelectItem>
            <SelectItem value="admin">{tEnums("role.admin")}</SelectItem>
            <SelectItem value="super_admin">
              {tEnums("role.super_admin")}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={initialParams.kyc}
          onValueChange={(value) =>
            pushParams({ kyc: value as UserListKycFilter })
          }
        >
          <SelectTrigger className="h-8 w-full text-xs sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("users.filters.kycAll")}</SelectItem>
            <SelectItem value="pending_docs">
              {t("users.filters.kycPendingDocs")}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={initialParams.sort}
          onValueChange={(value) => pushParams({ sort: value as UserListSort })}
        >
          <SelectTrigger className="h-8 w-full text-xs sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="attention">
              {t("users.filters.sort.attention")}
            </SelectItem>
            <SelectItem value="joined_desc">
              {t("users.filters.sort.joinedDesc")}
            </SelectItem>
            <SelectItem value="joined_asc">
              {t("users.filters.sort.joinedAsc")}
            </SelectItem>
            <SelectItem value="name_asc">
              {t("users.filters.sort.nameAsc")}
            </SelectItem>
            <SelectItem value="company_asc">
              {t("users.filters.sort.companyAsc")}
            </SelectItem>
          </SelectContent>
        </Select>

        {showClear ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clearFilters}
            className="h-8 text-xs"
          >
            <XIcon className="mr-1 size-3.5" />
            {t("users.filters.clearFilters")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
