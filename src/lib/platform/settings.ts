import "server-only";

import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSmsConfigured } from "@/lib/sms/client";

export const SMS_NOTIFICATIONS_KEY = "sms_notifications_enabled";

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
