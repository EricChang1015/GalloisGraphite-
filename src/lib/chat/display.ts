export type CounterpartyProfile = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  country: string | null;
  avatar_url?: string | null;
};

export function counterpartyLabel(p: CounterpartyProfile): string {
  return (
    p.company_name?.trim() ||
    p.full_name?.trim() ||
    "Trading partner"
  );
}

export function profileInitials(p: CounterpartyProfile): string {
  const source = p.company_name?.trim() || p.full_name?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
