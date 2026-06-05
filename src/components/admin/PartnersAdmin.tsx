"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { deletePartner, upsertPartner } from "@/actions/admin-partners";
import { uploadPartnerIcon } from "@/actions/admin-partners-upload";
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
import type { PartnerRow } from "@/lib/partners/types";

type Props = {
  partners: PartnerRow[];
  labels: {
    title: string;
    subtitle: string;
    addPartner: string;
    editPartner: string;
    deletePartner: string;
    deletePartnerConfirm: string;
    slug: string;
    name: string;
    href: string;
    hrefHint: string;
    sortOrder: string;
    published: string;
    save: string;
    uploadIcon: string;
    deleteSuccess: string;
    deleteFailed: string;
    saveSuccess: string;
    saveFailed: string;
    uploadSuccess: string;
    uploadFailed: string;
  };
};

type FormState = {
  id?: string;
  slug: string;
  name: string;
  href: string;
  sort_order: number;
  is_published: boolean;
};

const emptyForm = (): FormState => ({
  slug: "",
  name: "",
  href: "",
  sort_order: 0,
  is_published: true,
});

export function PartnersAdmin({ partners: initial, labels }: Props) {
  const [partners, setPartners] = useState(initial);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [uploadPartnerId, setUploadPartnerId] = useState<string | null>(null);

  const openEdit = (p: PartnerRow) => {
    setForm({
      id: p.id,
      slug: p.slug,
      name: p.name,
      href: p.href,
      sort_order: p.sort_order,
      is_published: p.is_published,
    });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setForm({
      ...emptyForm(),
      sort_order: (partners.length ?? 0) + 1,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    startTransition(async () => {
      const { data, error } = await upsertPartner(form);
      if (error) {
        toast.error(labels.saveFailed, { description: error.message });
        return;
      }
      toast.success(labels.saveSuccess);
      setDialogOpen(false);
      if (form.id) {
        setPartners((prev) =>
          prev.map((p) =>
            p.id === form.id
              ? {
                  ...p,
                  name: form.name,
                  href: form.href,
                  sort_order: form.sort_order,
                  is_published: form.is_published,
                }
              : p
          )
        );
      } else if (data?.id) {
        window.location.reload();
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm(labels.deletePartnerConfirm)) return;
    startTransition(async () => {
      const { error } = await deletePartner(id);
      if (error) {
        toast.error(labels.deleteFailed, { description: error.message });
        return;
      }
      toast.success(labels.deleteSuccess);
      setPartners((prev) => prev.filter((p) => p.id !== id));
    });
  };

  const handleUploadIcon = (partnerId: string, file: File) => {
    const fd = new FormData();
    fd.set("partner_id", partnerId);
    fd.set("file", file);
    startTransition(async () => {
      const { data, error } = await uploadPartnerIcon(fd);
      if (error) {
        toast.error(labels.uploadFailed, { description: error.message });
        return;
      }
      toast.success(labels.uploadSuccess);
      setPartners((prev) =>
        prev.map((p) =>
          p.id === partnerId
            ? { ...p, icon_url: data?.icon_url ?? p.icon_url }
            : p
        )
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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button type="button" />} onClick={openCreate}>
            <ImagePlus className="size-4" />
            {labels.addPartner}
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {form.id ? labels.editPartner : labels.addPartner}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="partner-slug">{labels.slug}</Label>
                <Input
                  id="partner-slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  disabled={!!form.id}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="partner-name">{labels.name}</Label>
                <Input
                  id="partner-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="partner-href">{labels.href}</Label>
                <Input
                  id="partner-href"
                  value={form.href}
                  placeholder="https://example.com"
                  onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">{labels.hrefHint}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="partner-sort">{labels.sortOrder}</Label>
                <Input
                  id="partner-sort"
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
                  id="partner-pub"
                  checked={form.is_published}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, is_published: v === true }))
                  }
                />
                <Label htmlFor="partner-pub">{labels.published}</Label>
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={pending}
                onClick={handleSave}
              >
                {labels.save}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <input
        ref={iconInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadPartnerId) handleUploadIcon(uploadPartnerId, file);
          e.target.value = "";
        }}
      />

      <div className="space-y-3">
        {partners.map((partner) => (
          <div
            key={partner.id}
            className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex size-16 shrink-0 items-center justify-center rounded border border-border bg-background p-2">
              {partner.icon_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={partner.icon_url}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{partner.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {partner.slug}
                {partner.href ? ` · ${partner.href}` : " · (no link)"}
              </p>
              <p className="text-xs text-muted-foreground">
                {labels.sortOrder}: {partner.sort_order}
                {!partner.is_published && " · unpublished"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setUploadPartnerId(partner.id);
                  iconInputRef.current?.click();
                }}
              >
                <Upload className="size-3.5" />
                {labels.uploadIcon}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => openEdit(partner)}
              >
                <Pencil className="size-3.5" />
                {labels.editPartner}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() => handleDelete(partner.id)}
              >
                <Trash2 className="size-3.5" />
                {labels.deletePartner}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
