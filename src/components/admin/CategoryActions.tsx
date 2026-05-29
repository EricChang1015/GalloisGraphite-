"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, PencilIcon } from "lucide-react";

import { CategoryInputSchema } from "@/lib/validations/admin";
import {
  upsertCategory,
  deleteCategory,
  reactivateCategory,
} from "@/actions/admin";
import {
  MESH_SIZES,
  PRODUCT_TYPES,
  parseCategorySpec,
  type CategorySpec,
} from "@/lib/categories/spec";
import type { z } from "zod";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CategoryInput = z.infer<typeof CategoryInputSchema>;

interface Category {
  id: string;
  name: string;
  description: string | null;
  spec_schema: Record<string, unknown> | null;
  is_active: boolean;
}

interface CategoryFormProps {
  existing?: Category;
}

const MESH_NONE = "__custom__";

export function CategoryFormDialog({ existing }: CategoryFormProps) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const initialSpec: CategorySpec = parseCategorySpec(existing?.spec_schema);

  const form = useForm<CategoryInput>({
    resolver: zodResolver(CategoryInputSchema) as never,
    defaultValues: {
      id: existing?.id,
      name: existing?.name ?? "",
      description: existing?.description ?? "",
      spec_schema: initialSpec,
      is_active: existing?.is_active ?? true,
    },
  });

  const isCustom = form.watch("spec_schema.is_custom");

  function onSubmit(values: CategoryInput) {
    // When is_custom is true, force mesh_size to null so the validator
    // accepts the row even if the user previously picked one.
    const payload: CategoryInput = {
      ...values,
      spec_schema: {
        ...values.spec_schema,
        mesh_size: values.spec_schema.is_custom
          ? null
          : values.spec_schema.mesh_size,
      },
    };

    startTransition(async () => {
      const result = await upsertCategory(payload);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(existing ? t("categories.form.updated") : t("categories.form.created"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          existing ? (
            <Button size="sm" variant="outline" className="h-7 text-xs" />
          ) : (
            <Button size="sm" />
          )
        }
      >
        {existing ? (
          <>
            <PencilIcon className="w-3 h-3 mr-1" />
            {tCommon("actions.edit")}
          </>
        ) : (
          <>
            <PlusIcon className="w-4 h-4 mr-2" />
            {t("categories.form.newCategory")}
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {existing ? t("categories.form.editCategory") : t("categories.form.newCategory")}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("categories.form.categoryName")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("categories.form.namePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("categories.form.description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder={t("categories.form.descriptionPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-md border bg-card/40 p-3 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("categories.form.specDefaults")}
              </p>

              <FormField
                control={form.control}
                name="spec_schema.product_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("categories.form.productType")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue>
                            {(value: unknown) =>
                              typeof value === "string" &&
                              (PRODUCT_TYPES as readonly string[]).includes(value)
                                ? t(`categories.productType.${value as "flake_graphite"}`)
                                : t("categories.form.selectProductType")
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRODUCT_TYPES.map((pt) => (
                          <SelectItem key={pt} value={pt}>
                            {t(`categories.productType.${pt}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="spec_schema.is_custom"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
                    <div>
                      <FormLabel className="text-sm">
                        {t("categories.form.customGrade")}
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("categories.form.customGradeHint")}
                      </p>
                    </div>
                    <FormControl>
                      <Button
                        type="button"
                        size="sm"
                        variant={field.value ? "default" : "outline"}
                        onClick={() => field.onChange(!field.value)}
                      >
                        {field.value ? t("categories.form.custom") : t("categories.form.standard")}
                      </Button>
                    </FormControl>
                  </FormItem>
                )}
              />

              {!isCustom && (
                <FormField
                  control={form.control}
                  name="spec_schema.mesh_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("categories.form.meshSize")}</FormLabel>
                      <Select
                        onValueChange={(v) =>
                          field.onChange(v === MESH_NONE ? null : v)
                        }
                        value={field.value ?? MESH_NONE}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("categories.form.selectMeshSize")}>
                              {(value: unknown) =>
                                typeof value === "string" && value && value !== MESH_NONE
                                  ? t("categories.form.meshOption", { size: value })
                                  : t("categories.form.selectMeshSize")
                              }
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MESH_SIZES.map((m) => (
                            <SelectItem key={m} value={m}>
                              {t("categories.form.meshOption", { size: m })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {t("categories.form.meshHint")}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="spec_schema.fixed_carbon_min"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("categories.form.fixedCarbonMin")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="spec_schema.fixed_carbon_max"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("categories.form.fixedCarbonMax")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="spec_schema.moisture_max"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("categories.form.moistureMax")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="spec_schema.size_distribution_min_pct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("categories.form.sizeDistributionMin")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {t("categories.form.sizeDistributionHint")}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {tCommon("actions.cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? tCommon("actions.saving") : tCommon("actions.save")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteCategoryButton({ categoryId }: { categoryId: string }) {
  const router = useRouter();
  const t = useTranslations("admin");
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCategory(categoryId);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("categories.form.deactivated"));
      router.refresh();
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleDelete}
      disabled={isPending}
      className="h-7 text-xs text-destructive hover:text-destructive"
    >
      {t("categories.form.deactivate")}
    </Button>
  );
}

export function ReactivateCategoryButton({
  categoryId,
}: {
  categoryId: string;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const [isPending, startTransition] = useTransition();

  function handleReactivate() {
    startTransition(async () => {
      const result = await reactivateCategory(categoryId);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("categories.form.reactivated"));
      router.refresh();
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleReactivate}
      disabled={isPending}
      className="h-7 text-xs text-green-400 hover:text-green-400"
    >
      {t("categories.form.reactivate")}
    </Button>
  );
}
