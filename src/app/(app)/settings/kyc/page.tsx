import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getMyKycProfile } from "@/actions/kyc";
import { KycUploadForm } from "@/components/kyc/KycUploadForm";
import { PhoneVerifyPanel } from "@/components/kyc/PhoneVerifyPanel";
import { Button } from "@/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const t = await getTranslations("kyc");
  return { title: t("metaTitle") };
}

export const dynamic = "force-dynamic";

export default async function KycSettingsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings/kyc");

  const t = await getTranslations("kyc");

  const kyc = await getMyKycProfile();
  if (kyc.error || !kyc.data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold">{t("heading")}</h1>
        <p className="text-sm text-destructive">
          {kyc.error?.message ?? t("loadError")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <Button variant="ghost" size="sm" className="px-0" render={<Link href="/settings" />}>
          {t("backToSettings")}
        </Button>
        <h1 className="font-serif text-3xl tracking-tight">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </header>

      <PhoneVerifyPanel
        phone={kyc.data.phone}
        phoneVerifiedAt={kyc.data.phoneVerifiedAt}
        kycLevel={kyc.data.kycLevel}
      />

      <section className="rounded-lg border border-border bg-card/40 p-6">
        <KycUploadForm
          userId={user.id}
          kycLevel={kyc.data.kycLevel}
          initialDocuments={kyc.data.documents}
        />
      </section>
    </div>
  );
}
