import { redirect } from "next/navigation";

import Link from "next/link";

import { CommercialProfileForm } from "@/components/auth/CommercialProfileForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createServerClient } from "@/lib/supabase/server";
import { findCommercialProfileGaps } from "@/lib/auth/commercial";

export const dynamic = "force-dynamic";

type ProfileRow = {
  email: string;
  full_name: string | null;
  company_name: string | null;
  country: string | null;
  phone: string | null;
  role: string;
  status: string;
  kyc_level: number | null;
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  const { prompt } = await searchParams;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, company_name, country, phone, role, status, kyc_level")
    .eq("id", user.id)
    .single<ProfileRow>();

  if (!profile) redirect("/login");

  const missing = await findCommercialProfileGaps(user.id);
  const showPrompt = prompt === "incomplete" || missing.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your account profile. Inquiries, listings and payments will use
          these details on contracts and admin records.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="outline" className="text-xs">
            {profile.role}
          </Badge>
          <Badge
            variant={profile.status === "active" ? "default" : "outline"}
            className="text-xs"
          >
            {profile.status}
          </Badge>
          <Badge variant="outline" className="text-xs">
            KYC level {profile.kyc_level ?? 0}
          </Badge>
        </div>
      </header>

      <section className="rounded-lg border border-border bg-card/40 p-6">
        <CommercialProfileForm
          email={profile.email}
          defaultValues={{
            full_name: profile.full_name ?? "",
            company_name: profile.company_name ?? "",
            country: profile.country ?? "",
            phone: profile.phone ?? "",
          }}
          prompt={showPrompt ? "incomplete" : null}
          missingFields={missing}
        />
      </section>

      <section className="rounded-lg border border-border bg-card/40 p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            KYC verification
          </h2>
          <Button variant="outline" size="sm" render={<Link href="/settings/kyc" />}>
            Manage KYC documents
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Verify your phone (Level 1) and upload ID or company documents for
          Level 2. Level 3 is assigned by admin for trusted sellers. Gates may
          require higher levels when enabled in admin settings.
        </p>
      </section>
    </div>
  );
}
