export type PartnerRow = {
  id: string;
  slug: string;
  name: string;
  href: string;
  icon_url: string | null;
  storage_path: string | null;
  sort_order: number;
  is_published: boolean;
};
