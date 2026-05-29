import { getTranslations } from "next-intl/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  SMS_NOTIFICATIONS_KEY,
  isSmsGatewayConfigured,
} from "@/lib/platform/settings";
import { KycThresholdSettings } from "@/components/admin/KycThresholdSettings";
import { SmsNotificationsToggle } from "@/components/admin/SmsNotificationsToggle";
import { getKycThresholds } from "@/lib/platform/settings";
import { SendTestEmailButton } from "@/components/admin/SendTestEmailButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: `${t("meta.settings")} — Mada Graphite` };
}

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const t = await getTranslations("admin");
  const admin = createAdminClient();

  const { data: setting } = await admin
    .from("platform_settings")
    .select("value, updated_at")
    .eq("key", SMS_NOTIFICATIONS_KEY)
    .maybeSingle<{ value: boolean; updated_at: string }>();

  const smsEnabled = setting?.value === true;
  const gatewayConfigured = isSmsGatewayConfigured();
  const kycThresholds = await getKycThresholds();

  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("settings.email.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1 text-sm">
            <p>
              {t("settings.email.status")}{" "}
              {smtpConfigured ? (
                <span className="text-emerald-400 font-medium">
                  {t("settings.email.configured")}
                </span>
              ) : (
                <span className="text-amber-400 font-medium">
                  {t("settings.email.notConfigured")}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">{t("settings.email.hint")}</p>
          </div>
          <SendTestEmailButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("settings.kycGates.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <KycThresholdSettings
            inquiryMinLevel={kycThresholds.inquiry}
            listingMinLevel={kycThresholds.listing}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("settings.notifications.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <SmsNotificationsToggle
            enabled={smsEnabled}
            gatewayConfigured={gatewayConfigured}
          />
          {setting?.updated_at && (
            <p className="text-xs text-muted-foreground mt-4">
              {t("settings.notifications.lastUpdated", {
                date: new Date(setting.updated_at).toLocaleString(),
              })}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
