import { createAdminClient } from "@/lib/supabase/admin";
import {
  SMS_NOTIFICATIONS_KEY,
  isSmsGatewayConfigured,
} from "@/lib/platform/settings";
import { SmsNotificationsToggle } from "@/components/admin/SmsNotificationsToggle";
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
