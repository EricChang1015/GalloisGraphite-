import "server-only";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Not authenticated." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return { user: null, error: "Admin access required." };
  }
  return { user, error: null };
}

export async function writeAuditLog(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>
) {
  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata: (metadata ?? {}) as import("@/types/database").Json,
    });
  } catch {
    // Audit failure must not break admin mutations.
  }
}

export function revalidatePublicMinePhotos() {
  try {
    revalidatePath("/mining-photos");
    revalidatePath("/about");
    revalidatePath("/");
  } catch {
    // Cache revalidation must not break admin mutations (e.g. sharp load on UAT).
  }
}

export function revalidateAllMinePhotos() {
  revalidatePublicMinePhotos();
  try {
    revalidatePath("/admin/mine-photos");
  } catch {
    // ignore
  }
}
