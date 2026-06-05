import { getTranslations } from "next-intl/server";

import { MinePhotosAdmin } from "@/components/admin/MinePhotosAdmin";
import { getAdminMinePhotoGallery } from "@/lib/mine-photos/queries";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: `${t("meta.minePhotos")} — Mada Graphite` };
}

export default async function AdminMinePhotosPage() {
  const t = await getTranslations("admin.minePhotos");
  const categories = await getAdminMinePhotoGallery();

  return (
    <MinePhotosAdmin
      categories={categories}
      labels={{
        title: t("title"),
        subtitle: t("subtitle"),
        addCategory: t("addCategory"),
        editCategory: t("editCategory"),
        deleteCategory: t("deleteCategory"),
        deleteCategoryConfirm: t("deleteCategoryConfirm"),
        slug: t("slug"),
        titleEn: t("titleEn"),
        titleZh: t("titleZh"),
        sortOrder: t("sortOrder"),
        published: t("published"),
        save: t("save"),
        uploadPhoto: t("uploadPhoto"),
        uploadCover: t("uploadCover"),
        deletePhoto: t("deletePhoto"),
        deletePhotoConfirm: t("deletePhotoConfirm"),
        altEn: t("altEn"),
        altZh: t("altZh"),
        photosCount: t("photosCount"),
        uploadSuccess: t("uploadSuccess"),
        uploadFailed: t("uploadFailed"),
        saveSuccess: t("saveSuccess"),
        saveFailed: t("saveFailed"),
        deleteSuccess: t("deleteSuccess"),
        deleteFailed: t("deleteFailed"),
      }}
    />
  );
}
