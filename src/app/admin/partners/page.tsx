import { getTranslations } from "next-intl/server";

import { PartnersAdmin } from "@/components/admin/PartnersAdmin";
import { getAdminPartners } from "@/lib/partners/queries";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: `${t("meta.partners")} — Mada Graphite` };
}

export default async function AdminPartnersPage() {
  const t = await getTranslations("admin.partners");
  const partners = await getAdminPartners();

  return (
    <PartnersAdmin
      partners={partners}
      labels={{
        title: t("title"),
        subtitle: t("subtitle"),
        addPartner: t("addPartner"),
        editPartner: t("editPartner"),
        deletePartner: t("deletePartner"),
        deletePartnerConfirm: t("deletePartnerConfirm"),
        slug: t("slug"),
        name: t("name"),
        href: t("href"),
        hrefHint: t("hrefHint"),
        sortOrder: t("sortOrder"),
        published: t("published"),
        save: t("save"),
        uploadIcon: t("uploadIcon"),
        deleteSuccess: t("deleteSuccess"),
        deleteFailed: t("deleteFailed"),
        saveSuccess: t("saveSuccess"),
        saveFailed: t("saveFailed"),
        uploadSuccess: t("uploadSuccess"),
        uploadFailed: t("uploadFailed"),
      }}
    />
  );
}
