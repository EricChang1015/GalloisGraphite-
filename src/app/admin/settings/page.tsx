import { createAdminClient } from "@/lib/supabase/admin";
import {
  SMS_NOTIFICATIONS_KEY,
  isSmsGatewayConfigured,
} from "@/lib/platform/settings";
import { SmsNotificationsToggle } from "@/components/admin/SmsNotificationsToggle";
import { SendTestEmailButton } from "@/components/admin/SendTestEmailButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Admin · Settings" };

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admin = createAdminClient();

  const { data: setting } = await admin
    .from("platform_settings")
    .select("value, updated_at")
    .eq("key", SMS_NOTIFICATIONS_KEY)
    .maybeSingle<{ value: boolean; updated_at: string }>();

  const smsEnabled = setting?.value === true;
  const gatewayConfigured = isSmsGatewayConfigured();

  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure platform-wide notification and integration options.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Email (SMTP)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1 text-sm">
            <p>
              Status:{" "}
              {smtpConfigured ? (
                <span className="text-emerald-400 font-medium">Configured</span>
              ) : (
                <span className="text-amber-400 font-medium">Not configured</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Configure SMTP_HOST / SMTP_USER / SMTP_PASS / EMAIL_FROM_ADDRESS in
              .env.local. AWS SES domain must be verified before sending to
              non-verified recipients (production access required).
            </p>
          </div>
          <SendTestEmailButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <SmsNotificationsToggle
            enabled={smsEnabled}
            gatewayConfigured={gatewayConfigured}
          />
          {setting?.updated_at && (
            <p className="text-xs text-muted-foreground mt-4">
              Last updated: {new Date(setting.updated_at).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
