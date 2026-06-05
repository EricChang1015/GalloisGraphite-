"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  deleteMinePhoto,
  deleteMinePhotoCategory,
  updateMinePhoto,
  uploadMinePhoto,
  uploadMinePhotoCover,
  upsertMinePhotoCategory,
} from "@/actions/admin-mine-photos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { MinePhotoCategoryWithPhotos } from "@/lib/mine-photos/queries";

type Props = {
  categories: MinePhotoCategoryWithPhotos[];
  labels: {
    title: string;
    subtitle: string;
    addCategory: string;
    editCategory: string;
    deleteCategory: string;
    deleteCategoryConfirm: string;
    slug: string;
    titleEn: string;
    titleZh: string;
    sortOrder: string;
    published: string;
    save: string;
    uploadPhoto: string;
    uploadCover: string;
    deletePhoto: string;
    deletePhotoConfirm: string;
    altEn: string;
    altZh: string;
    photosCount: string;
    uploadSuccess: string;
    uploadFailed: string;
    saveSuccess: string;
    saveFailed: string;
    deleteSuccess: string;
    deleteFailed: string;
  };
};

type CategoryFormState = {
  id?: string;
  slug: string;
  title_en: string;
  title_zh_cn: string;
  sort_order: number;
  is_published: boolean;
};

const emptyCategory = (): CategoryFormState => ({
  slug: "",
  title_en: "",
  title_zh_cn: "",
  sort_order: 0,
  is_published: true,
});

export function MinePhotosAdmin({ categories: initial, labels }: Props) {
  const [categories, setCategories] = useState(initial);
  const [form, setForm] = useState<CategoryFormState>(emptyCategory());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadCategoryId, setUploadCategoryId] = useState<string | null>(null);

  const openEdit = (cat: MinePhotoCategoryWithPhotos) => {
    setForm({
      id: cat.id,
      slug: cat.slug,
      title_en: cat.title_en,
      title_zh_cn: cat.title_zh_cn,
      sort_order: cat.sort_order,
      is_published: cat.is_published,
    });
    setDialogOpen(true);
  };

  const openCreateCategory = () => {
    setForm(emptyCategory());
    setDialogOpen(true);
  };

  const handleSaveCategory = () => {
    startTransition(async () => {
      const { data, error } = await upsertMinePhotoCategory(form);
      if (error) {
        toast.error(labels.saveFailed, { description: error.message });
        return;
      }
      toast.success(labels.saveSuccess);
      setDialogOpen(false);
      window.location.reload();
    });
  };

  const handleDeleteCategory = (id: string) => {
    if (!window.confirm(labels.deleteCategoryConfirm)) return;
    startTransition(async () => {
      const { error } = await deleteMinePhotoCategory(id);
      if (error) {
        toast.error(labels.deleteFailed, { description: error.message });
        return;
      }
      toast.success(labels.deleteSuccess);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    });
  };

  const handleUploadPhoto = (categoryId: string, file: File) => {
    const fd = new FormData();
    fd.set("category_id", categoryId);
    fd.set("file", file);
    const cat = categories.find((c) => c.id === categoryId);
    fd.set("sort_order", String((cat?.photos.length ?? 0) + 1));
    startTransition(async () => {
      const { error } = await uploadMinePhoto(fd);
      if (error) {
        toast.error(labels.uploadFailed, { description: error.message });
        return;
      }
      toast.success(labels.uploadSuccess);
      window.location.reload();
    });
  };

  const handleUploadCover = (categoryId: string, file: File) => {
    const fd = new FormData();
    fd.set("category_id", categoryId);
    fd.set("file", file);
    startTransition(async () => {
      const { error } = await uploadMinePhotoCover(fd);
      if (error) {
        toast.error(labels.uploadFailed, { description: error.message });
        return;
      }
      toast.success(labels.uploadSuccess);
      window.location.reload();
    });
  };

  const handleDeletePhoto = (photoId: string) => {
    if (!window.confirm(labels.deletePhotoConfirm)) return;
    startTransition(async () => {
      const { error } = await deleteMinePhoto(photoId);
      if (error) {
        toast.error(labels.deleteFailed, { description: error.message });
        return;
      }
      toast.success(labels.deleteSuccess);
      setCategories((prev) =>
        prev.map((c) => ({
          ...c,
          photos: c.photos.filter((p) => p.id !== photoId),
        }))
      );
    });
  };

  const handlePhotoMeta = (
    photoId: string,
    patch: Partial<{
      alt_en: string;
      alt_zh_cn: string;
      sort_order: number;
      is_published: boolean;
    }>
  ) => {
    const photo = categories.flatMap((c) => c.photos).find((p) => p.id === photoId);
    if (!photo) return;
    startTransition(async () => {
      const { error } = await updateMinePhoto({
        id: photoId,
        alt_en: patch.alt_en ?? photo.alt_en,
        alt_zh_cn: patch.alt_zh_cn ?? photo.alt_zh_cn,
        sort_order: patch.sort_order ?? photo.sort_order,
        is_published: patch.is_published ?? photo.is_published,
      });
      if (error) {
        toast.error(labels.saveFailed, { description: error.message });
        return;
      }
      toast.success(labels.saveSuccess);
      setCategories((prev) =>
        prev.map((c) => ({
          ...c,
          photos: c.photos.map((p) =>
            p.id === photoId ? { ...p, ...patch } : p
          ),
        }))
      );
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">{labels.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (open && !form.id) setForm(emptyCategory());
          }}
        >
          <DialogTrigger
            render={<Button type="button" />}
            onClick={openCreateCategory}
          >
            <ImagePlus className="size-4" />
            {labels.addCategory}
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {form.id ? labels.editCategory : labels.addCategory}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="cat-slug">{labels.slug}</Label>
                <Input
                  id="cat-slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  disabled={!!form.id}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cat-title-en">{labels.titleEn}</Label>
                <Input
                  id="cat-title-en"
                  value={form.title_en}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title_en: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cat-title-zh">{labels.titleZh}</Label>
                <Input
                  id="cat-title-zh"
                  value={form.title_zh_cn}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title_zh_cn: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cat-sort">{labels.sortOrder}</Label>
                <Input
                  id="cat-sort"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sort_order: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cat-pub"
                  checked={form.is_published}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, is_published: v === true }))
                  }
                />
                <Label htmlFor="cat-pub">{labels.published}</Label>
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={pending}
                onClick={handleSaveCategory}
              >
                {labels.save}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadCategoryId) handleUploadPhoto(uploadCategoryId, file);
          e.target.value = "";
        }}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadCategoryId) handleUploadCover(uploadCategoryId, file);
          e.target.value = "";
        }}
      />

      <div className="space-y-8">
        {categories.map((cat) => (
          <section
            key={cat.id}
            className="rounded-lg border border-border bg-card p-4 space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                {cat.cover_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={cat.cover_url}
                    alt=""
                    className="size-16 rounded object-cover border border-border"
                  />
                )}
                <div>
                  <h2 className="font-semibold">{cat.title_en}</h2>
                  <p className="text-xs text-muted-foreground">
                    {cat.slug} · {labels.photosCount.replace("{count}", String(cat.photos.length))}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => openEdit(cat)}
                >
                  <Pencil className="size-3.5" />
                  {labels.editCategory}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setUploadCategoryId(cat.id);
                    coverInputRef.current?.click();
                  }}
                >
                  <Upload className="size-3.5" />
                  {labels.uploadCover}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setUploadCategoryId(cat.id);
                    photoInputRef.current?.click();
                  }}
                >
                  <ImagePlus className="size-3.5" />
                  {labels.uploadPhoto}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => handleDeleteCategory(cat.id)}
                >
                  <Trash2 className="size-3.5" />
                  {labels.deleteCategory}
                </Button>
              </div>
            </div>

            {cat.photos.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cat.photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="flex gap-3 rounded border border-border p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumb_url}
                      alt=""
                      className="size-20 shrink-0 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Input
                        placeholder={labels.altEn}
                        defaultValue={photo.alt_en}
                        className="h-8 text-xs"
                        onBlur={(e) => {
                          if (e.target.value !== photo.alt_en) {
                            handlePhotoMeta(photo.id, { alt_en: e.target.value });
                          }
                        }}
                      />
                      <Input
                        placeholder={labels.altZh}
                        defaultValue={photo.alt_zh_cn}
                        className="h-8 text-xs"
                        onBlur={(e) => {
                          if (e.target.value !== photo.alt_zh_cn) {
                            handlePhotoMeta(photo.id, { alt_zh_cn: e.target.value });
                          }
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          defaultValue={photo.sort_order}
                          className="h-8 w-16 text-xs"
                          onBlur={(e) => {
                            const n = Number(e.target.value);
                            if (!Number.isNaN(n) && n !== photo.sort_order) {
                              handlePhotoMeta(photo.id, { sort_order: n });
                            }
                          }}
                        />
                        <Checkbox
                          checked={photo.is_published}
                          onCheckedChange={(v) =>
                            handlePhotoMeta(photo.id, {
                              is_published: v === true,
                            })
                          }
                          aria-label={labels.published}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="ml-auto size-8 text-destructive"
                          disabled={pending}
                          onClick={() => handleDeletePhoto(photo.id)}
                          aria-label={labels.deletePhoto}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
