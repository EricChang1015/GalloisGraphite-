import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { CommercialProfileForm } from "@/components/auth/CommercialProfileForm";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { LanguageSelector } from "@/components/settings/LanguageSelector";
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
  avatar_url: string | null;
  role: string;
  status: string;
  kyc_level: number | null;
};

export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: `${t("metaTitle")} — Mada Graphite` };
}

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
    .select(
      "email, full_name, company_name, country, phone, avatar_url, role, status, kyc_level"
    )
    .eq("id", user.id)
    .single<ProfileRow>();

  if (!profile) redirect("/login");

  const missing = await findCommercialProfileGaps(user.id);
  const showPrompt = prompt === "incomplete" || missing.length > 0;

  const t = await getTranslations("settings");
  const tEnums = await getTranslations("enums");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="outline" className="text-xs">
            {tEnums(`role.${profile.role as "buyer" | "seller" | "admin" | "super_admin"}`)}
          </Badge>
          <Badge
            variant={profile.status === "active" ? "default" : "outline"}
            className="text-xs"
          >
            {tEnums(`accountStatus.${profile.status as "active" | "pending" | "frozen"}`)}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {tEnums("kyc.levelLabel", { level: profile.kyc_level ?? 0 })}
          </Badge>
        </div>
      </header>

      <section className="rounded-lg border border-border bg-card/40 p-6 space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {t("photoSection.title")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("photoSection.body")}
          </p>
          <div className="mt-4">
            <AvatarUploader
              userId={user.id}
              profile={{
                full_name: profile.full_name,
                company_name: profile.company_name,
                avatar_url: profile.avatar_url,
              }}
            />
          </div>
        </div>
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
        <h2 className="text-sm font-semibold text-foreground">
          {t("languageSection.title")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("languageSection.body")}
        </p>
        <LanguageSelector />
      </section>

      <section className="rounded-lg border border-border bg-card/40 p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {t("kycSection.title")}
          </h2>
          <Button variant="outline" size="sm" render={<Link href="/settings/kyc" />}>
            {t("kycSection.manage")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("kycSection.body")}</p>
      </section>
    </div>
  );
}
