export type UserListAttentionFilter = "needs_action" | "all";
export type UserListStatusFilter = "active" | "pending" | "frozen" | "all";
export type UserListRoleFilter = "buyer" | "seller" | "admin" | "super_admin" | "all";
export type UserListKycFilter = "pending_docs" | "all";
export type UserListSort =
  | "attention"
  | "joined_desc"
  | "joined_asc"
  | "name_asc"
  | "company_asc";

export type UserListFilterParams = {
  q?: string;
  attention?: UserListAttentionFilter;
  status?: UserListStatusFilter;
  role?: UserListRoleFilter;
  kyc?: UserListKycFilter;
  sort?: UserListSort;
};

const STATUS_FILTERS: UserListStatusFilter[] = ["active", "pending", "frozen", "all"];
const ROLE_FILTERS: UserListRoleFilter[] = ["buyer", "seller", "admin", "super_admin", "all"];
const SORT_OPTIONS: UserListSort[] = [
  "attention",
  "joined_desc",
  "joined_asc",
  "name_asc",
  "company_asc",
];

export function parseUserListParams(
  params: Record<string, string | undefined>
): Required<UserListFilterParams> {
  const attention =
    params.attention === "needs_action" ? "needs_action" : "all";
  const status = STATUS_FILTERS.includes(params.status as UserListStatusFilter)
    ? (params.status as UserListStatusFilter)
    : "all";
  const role = ROLE_FILTERS.includes(params.role as UserListRoleFilter)
    ? (params.role as UserListRoleFilter)
    : "all";
  const kyc = params.kyc === "pending_docs" ? "pending_docs" : "all";
  const sort = SORT_OPTIONS.includes(params.sort as UserListSort)
    ? (params.sort as UserListSort)
    : "attention";

  return {
    q: params.q?.trim() ?? "",
    attention,
    status,
    role,
    kyc,
    sort,
  };
}

export function hasActiveUserFilters(params: UserListFilterParams): boolean {
  return Boolean(
    params.q?.trim() ||
      params.attention === "needs_action" ||
      (params.status && params.status !== "all") ||
      (params.role && params.role !== "all") ||
      params.kyc === "pending_docs" ||
      (params.sort && params.sort !== "attention")
  );
}
