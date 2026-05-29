import { parseKycDocs, summarizeKycDocs } from "@/lib/kyc/types";
import type { Json } from "@/types/database";

import type {
  UserListFilterParams,
  UserListSort,
} from "@/lib/admin/user-list-filters";

export type {
  UserListAttentionFilter,
  UserListFilterParams,
  UserListKycFilter,
  UserListRoleFilter,
  UserListSort,
  UserListStatusFilter,
} from "@/lib/admin/user-list-filters";

export { hasActiveUserFilters, parseUserListParams } from "@/lib/admin/user-list-filters";

export type AdminUserRaw = {
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
};

export type AttentionReason = "kyc_pending" | "status_pending" | "profile_incomplete";

export type AdminUserRow = AdminUserRaw & {
  attentionScore: number;
  attentionReasons: AttentionReason[];
  pendingDocCount: number;
};

function isProfileIncomplete(row: AdminUserRaw): boolean {
  return !row.company_name?.trim() || !row.country?.trim();
}

function hasPendingDocuments(docs: ReturnType<typeof parseKycDocs>): boolean {
  return docs.some((d) => (d.status ?? "pending") === "pending");
}

function computeAttention(row: AdminUserRaw): {
  attentionScore: number;
  attentionReasons: AttentionReason[];
} {
  const docs = parseKycDocs(row.kyc_docs);
  const reasons: AttentionReason[] = [];

  if (hasPendingDocuments(docs)) {
    reasons.push("kyc_pending");
  }
  if (row.status === "pending") {
    reasons.push("status_pending");
  }
  if (isProfileIncomplete(row)) {
    reasons.push("profile_incomplete");
  }

  let attentionScore = 0;
  if (reasons.includes("kyc_pending")) attentionScore = 1;
  else if (reasons.includes("status_pending")) attentionScore = 2;
  else if (reasons.includes("profile_incomplete")) attentionScore = 3;

  return { attentionScore, attentionReasons: reasons };
}

export function enrichUserRow(raw: AdminUserRaw): AdminUserRow {
  const { attentionScore, attentionReasons } = computeAttention(raw);
  const pendingDocCount = summarizeKycDocs(parseKycDocs(raw.kyc_docs)).pending;

  return {
    ...raw,
    attentionScore,
    attentionReasons,
    pendingDocCount,
  };
}

function matchesSearch(row: AdminUserRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const haystack = [
    row.email,
    row.full_name,
    row.company_name,
    row.country,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterUsers(
  rows: AdminUserRow[],
  params: UserListFilterParams
): AdminUserRow[] {
  const { q = "", attention = "all", status = "all", role = "all", kyc = "all" } =
    params;

  return rows.filter((row) => {
    if (attention === "needs_action" && row.attentionScore === 0) return false;
    if (status !== "all" && row.status !== status) return false;
    if (role !== "all" && row.role !== role) return false;
    if (kyc === "pending_docs" && row.pendingDocCount === 0) return false;
    if (!matchesSearch(row, q)) return false;
    return true;
  });
}

function compareJoined(a: AdminUserRow, b: AdminUserRow, ascending: boolean): number {
  const diff =
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  return ascending ? diff : -diff;
}

function compareNullableString(
  a: string | null,
  b: string | null,
  ascending: boolean
): number {
  const left = (a ?? "").trim().toLowerCase();
  const right = (b ?? "").trim().toLowerCase();
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const diff = left.localeCompare(right);
  return ascending ? diff : -diff;
}

export function sortUsers(
  rows: AdminUserRow[],
  sort: UserListSort = "attention"
): AdminUserRow[] {
  const copy = [...rows];

  copy.sort((a, b) => {
    switch (sort) {
      case "attention": {
        if (a.attentionScore !== b.attentionScore) {
          return a.attentionScore - b.attentionScore;
        }
        return compareJoined(a, b, false);
      }
      case "joined_desc":
        return compareJoined(a, b, false);
      case "joined_asc":
        return compareJoined(a, b, true);
      case "name_asc":
        return compareNullableString(a.full_name, b.full_name, true);
      case "company_asc":
        return compareNullableString(a.company_name, b.company_name, true);
      default:
        return 0;
    }
  });

  return copy;
}

export function countNeedsAction(rows: AdminUserRow[]): number {
  return rows.filter((row) => row.attentionScore > 0).length;
}
