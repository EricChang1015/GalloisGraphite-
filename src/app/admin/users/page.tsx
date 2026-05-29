import { getTranslations } from "next-intl/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserActions } from "@/components/admin/UserActions";
import { KycAdminBadge } from "@/components/admin/KycAdminBadge";
import { UserKycDialog } from "@/components/admin/UserKycDialog";
import { parseKycDocs, summarizeKycDocs } from "@/lib/kyc/types";
import type { Json } from "@/types/database";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: `${t("meta.users")} — Mada Graphite` };
}

export default async function AdminUsersPage() {
  const t = await getTranslations("admin");
  const tEnums = await getTranslations("enums");
  const admin = createAdminClient();

  const { data: users } = await admin
    .from("profiles")
    .select(
      "id, email, full_name, company_name, country, role, status, kyc_level, kyc_docs, phone_verified_at, created_at"
    )
    .order("created_at", { ascending: false })
    .returns<{
      id: string;
      email: string;
      full_name: string | null;
      company_name: string | null;
      country: string | null;
      role: string;
      status: string;
      kyc_level: number;
      kyc_docs: Json;
      phone_verified_at: string | null;
      created_at: string;
    }[]>();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("users.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("users.subtitle")}</p>
      </div>

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
            {(users ?? []).map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="text-sm font-medium">{u.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell className="text-sm">{u.company_name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.country || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={roleColor[u.role] ?? ""}>
                    {tEnums(`role.${u.role as "buyer" | "seller" | "admin" | "super_admin"}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColor[u.status] ?? ""}>
                    {tEnums(`accountStatus.${u.status as "active" | "pending" | "frozen"}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <KycAdminBadge
                    kycLevel={u.kyc_level}
                    kycDocs={u.kyc_docs}
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
                      pendingDocCount={
                        summarizeKycDocs(parseKycDocs(u.kyc_docs)).pending
                      }
                    />
                    {u.role !== "super_admin" && (
                      <UserActions
                        userId={u.id}
                        currentRole={u.role}
                        currentStatus={u.status}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
