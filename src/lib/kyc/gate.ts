import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import {
  getKycMinLevelInquiry,
  getKycMinLevelListing,
} from "@/lib/platform/settings";

export type KycGateAction = "submit_inquiry" | "create_listing";

export type KycGateResult =
  | { ok: true }
  | {
      ok: false;
      requiredLevel: number;
      currentLevel: number;
      action: KycGateAction;
    };

export async function checkKycGate(
  userId: string,
  action: KycGateAction
): Promise<KycGateResult> {
  const requiredLevel =
    action === "submit_inquiry"
      ? await getKycMinLevelInquiry()
      : await getKycMinLevelListing();

  if (requiredLevel <= 0) {
    return { ok: true };
  }

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("kyc_level")
    .eq("id", userId)
    .maybeSingle<{ kyc_level: number }>();

  const currentLevel = data?.kyc_level ?? 0;
  if (currentLevel >= requiredLevel) {
    return { ok: true };
  }

  return { ok: false, requiredLevel, currentLevel, action };
}
