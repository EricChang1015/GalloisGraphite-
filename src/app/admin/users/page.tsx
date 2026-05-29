import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { AdminUsersToolbar } from "@/components/admin/AdminUsersToolbar";
import { KycAdminBadge } from "@/components/admin/KycAdminBadge";
import { UserActions } from "@/components/admin/UserActions";
import { UserKycDialog } from "@/components/admin/UserKycDialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  countNeedsAction,
  enrichUserRow,
  filterUsers,
  parseUserListParams,
  sortUsers,
  type AdminUserRaw,
  type AttentionReason,
} from "@/lib/admin/user-list";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: `${t("meta.users")} — Mada Graphite` };
}

const roleColor: Record<string, string> = {
  buyer: "",
  seller: "text-blue-400 border-blue-400/40",
  admin: "text-amber-400 border-amber-400/40",
  super_admin: "text-red-400 border-red-400/40",
};

const statusColor: Record<string, string> = {
  active: "text-green-400 border-green-400/40",
  pending: "text-yellow-400 border-yellow-400/40",
  frozen: "text-red-400 border-red-400/40",
};

function attentionReasonKey(reason: AttentionReason) {
  return `users.filters.attention.reason.${reason === "kyc_pending" ? "kycPending" : reason === "status_pending" ? "statusPending" : "profileIncomplete"}` as const;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const t = await getTranslations("admin");
  const tEnums = await getTranslations("enums");
  const params = parseUserListParams((await searchParams) ?? {});
  const admin = createAdminClient();

  const { data: users } = await admin
    .from("profiles")
    .select(
      "id, email, full_name, company_name, country, role, status, kyc_level, kyc_docs, phone_verified_at, created_at"
    )
    .returns<AdminUserRaw[]>();

  const enriched = (users ?? []).map(enrichUserRow);
  const needsActionCount = countNeedsAction(enriched);
  const filtered = sortUsers(filterUsers(enriched, params), params.sort);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="sticky top-0 z-10 -mx-4 space-y-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">{t("users.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("users.subtitle")}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("users.filters.summary", {
              shown: filtered.length,
              total: enriched.length,
              needsAction: needsActionCount,
            })}
          </p>
        </div>

        <Suspense fallback={null}>
          <AdminUsersToolbar
            needsActionCount={needsActionCount}
            initialParams={params}
          />
        </Suspense>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p>{t("users.filters.noResults")}</p>
          <Link
            href="/admin/users"
            className="mt-3 inline-block text-primary underline"
          >
            {t("users.filters.clearFilters")}
          </Link>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("users.table.user")}</TableHead>
                <TableHead>{t("users.table.company")}</TableHead>
                <TableHead>{t("users.table.country")}</TableHead>
                <TableHead>{t("users.table.role")}</TableHead>
                <TableHead>{t("users.table.status")}</TableHead>
                <TableHead>{t("users.table.kyc")}</TableHead>
                <TableHead>{t("users.table.joined")}</TableHead>
                <TableHead>{t("users.table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const attentionTitle = u.attentionReasons
                  .map((reason) => t(attentionReasonKey(reason)))
                  .join(" · ");

                return (
                  <TableRow
                    key={u.id}
                    className={cn(
                      u.attentionScore > 0 &&
                        "border-l-2 border-l-amber-400/80 bg-amber-500/5"
                    )}
                  >
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <div>
                          <div className="text-sm font-medium">
                            {u.full_name || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {u.email}
                          </div>
                        </div>
                        {u.attentionScore > 0 ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-400/40 text-amber-400"
                            title={attentionTitle}
                          >
                            {t("users.filters.attention.badge")}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {u.company_name || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.country || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={roleColor[u.role] ?? ""}>
                        {tEnums(
                          `role.${u.role as "buyer" | "seller" | "admin" | "super_admin"}`
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusColor[u.status] ?? ""}
                      >
                        {tEnums(
                          `accountStatus.${u.status as "active" | "pending" | "frozen"}`
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <KycAdminBadge
                        kycLevel={u.kyc_level}
                        kycDocs={u.kyc_docs as Json}
                        phoneVerifiedAt={u.phone_verified_at}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <UserKycDialog
                          userId={u.id}
                          userLabel={u.company_name || u.full_name || u.email}
                          currentKycLevel={u.kyc_level}
                          pendingDocCount={u.pendingDocCount}
                        />
                        {u.role !== "super_admin" ? (
                          <UserActions
                            userId={u.id}
                            currentRole={u.role}
                            currentStatus={u.status}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
