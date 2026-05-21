import Link from "next/link";
import { redirect } from "next/navigation";

import { getMyKycProfile } from "@/actions/kyc";
import { KycUploadForm } from "@/components/kyc/KycUploadForm";
import { PhoneVerifyPanel } from "@/components/kyc/PhoneVerifyPanel";
import { Button } from "@/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";

export const metadata = { title: "KYC Verification" };

export const dynamic = "force-dynamic";

export default async function KycSettingsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings/kyc");

  const kyc = await getMyKycProfile();
  if (kyc.error || !kyc.data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold">KYC verification</h1>
        <p className="text-sm text-destructive">
          {kyc.error?.message ?? "Could not load KYC profile."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <Button variant="ghost" size="sm" className="px-0" render={<Link href="/settings" />}>
          ← Back to Settings
        </Button>
        <h1 className="font-serif text-3xl tracking-tight">KYC verification</h1>
        <p className="text-sm text-muted-foreground">
          Level 0 is your email login. Verify your phone for Level 1, upload
          ID or company documents for Level 2 (admin review). Level 3 is assigned
          by admin for trusted sellers.
        </p>
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
