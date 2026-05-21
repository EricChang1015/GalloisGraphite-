import "server-only";

import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSmsConfigured } from "@/lib/sms/client";

export const SMS_NOTIFICATIONS_KEY = "sms_notifications_enabled";
export const KYC_MIN_LEVEL_INQUIRY_KEY = "kyc_min_level_inquiry";
export const KYC_MIN_LEVEL_LISTING_KEY = "kyc_min_level_listing";

const KYC_LEVEL_MIN = 0;
const KYC_LEVEL_MAX = 2;

function parseKycMinLevel(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) {
    return Math.min(KYC_LEVEL_MAX, Math.max(KYC_LEVEL_MIN, value));
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const n = Number.parseInt(value, 10);
    return Math.min(KYC_LEVEL_MAX, Math.max(KYC_LEVEL_MIN, n));
  }
  return 0;
}

async function fetchKycMinLevel(key: string): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle<{ value: unknown }>();
    return parseKycMinLevel(data?.value);
  } catch {
    return 0;
  }
}

export const getKycMinLevelInquiry = cache(async (): Promise<number> =>
  fetchKycMinLevel(KYC_MIN_LEVEL_INQUIRY_KEY)
);

export const getKycMinLevelListing = cache(async (): Promise<number> =>
  fetchKycMinLevel(KYC_MIN_LEVEL_LISTING_KEY)
);

export async function getKycThresholds(): Promise<{
  inquiry: number;
  listing: number;
}> {
  const [inquiry, listing] = await Promise.all([
    getKycMinLevelInquiry(),
    getKycMinLevelListing(),
  ]);
  return { inquiry, listing };
}

export function isSmsGatewayConfigured(): boolean {
  return isSmsConfigured();
}

export const getSmsNotificationsEnabled = cache(async (): Promise<boolean> => {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", SMS_NOTIFICATIONS_KEY)
      .maybeSingle<{ value: boolean }>();

    return data?.value === true;
  } catch {
    return false;
  }
});
