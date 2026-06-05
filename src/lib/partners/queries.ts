import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type { PartnerRow } from "@/lib/partners/types";
import type { PartnerRow } from "@/lib/partners/types";

export async function getPublishedPartners(): Promise<PartnerRow[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("partners")
    .select(
      "id, slug, name, href, icon_url, storage_path, sort_order, is_published"
    )
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .returns<PartnerRow[]>();
  return data ?? [];
}

export async function getAdminPartners(): Promise<PartnerRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partners")
    .select(
      "id, slug, name, href, icon_url, storage_path, sort_order, is_published"
    )
    .order("sort_order", { ascending: true })
    .returns<PartnerRow[]>();
  return data ?? [];
}
