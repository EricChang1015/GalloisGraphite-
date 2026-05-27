"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { createListing, updateListing } from "@/actions/listing";
import {
  ListingInputSchema,
  type ListingInput,
} from "@/lib/validations/forms";
import {
  MESH_SIZES,
  PRODUCT_TYPE_LABEL,
  buildListingTitle,
  describeCategorySpec,
  formatMeshSelection,
  parseCategorySpec,
  type CategorySpec,
  type MeshSize,
} from "@/lib/categories/spec";
import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ListingImageUploader } from "@/components/listing/ListingImageUploader";
import { cn } from "@/lib/utils";

export interface CategoryOption {
  id: string;
  name: string;
  description: string | null;
  spec_schema: Record<string, unknown> | null;
}

/**
 * Existing listing fields used to pre-fill the form when editing.
 * Mirrors the columns we select in `/listings/[id]/edit/page.tsx`.
 */
export interface ExistingListing {
  id: string;
  category_id: string;
  title: string;
  specs: Record<string, unknown> | null;
  quantity: number;
  min_order_quantity: number | null;
  unit: string;
  origin_location: string;
  available_from: string | null;
  available_to: string | null;
  unit_price: number;
  currency: string;
  incoterm: string;
  description: string | null;
  images: string[] | null;
}

interface ListingFormProps {
  categories: CategoryOption[];
  /** When provided the form runs in "edit" mode and calls updateListing(id). */
  existing?: ExistingListing;
}

export function ListingForm({ categories, existing }: ListingFormProps) {
  const router = useRouter();
  const t = useTranslations("listings.form");
  const tEnums = useTranslations("enums");
  const [isPending, startTransition] = useTransition();
  const isEdit = !!existing;
  /** Track whether the seller has manually edited the title so we don't
   *  clobber their text on auto-fill. In edit mode they already typed
   *  the title once, so suppress auto-fill. */
  const [titleEdited, setTitleEdited] = useState(isEdit);

  const form = useForm<ListingInput>({
    resolver: zodResolver(ListingInputSchema) as never,
    defaultValues: existing
      ? {
          category_id: existing.category_id,
          title: existing.title,
          specs: (existing.specs ?? {}) as ListingInput["specs"],
          quantity: existing.quantity,
          min_order_quantity:
            existing.min_order_quantity == null
              ? undefined
              : existing.min_order_quantity,
          unit:
            existing.unit === "KG" || existing.unit === "MT"
              ? (existing.unit as "MT" | "KG")
              : "MT",
          origin_location: existing.origin_location,
          available_from: existing.available_from ?? "",
          available_to: existing.available_to ?? "",
          unit_price: existing.unit_price,
          currency: existing.currency,
          incoterm:
            existing.incoterm === "CFR" ||
            existing.incoterm === "CIF" ||
            existing.incoterm === "FOB"
              ? (existing.incoterm as "CFR" | "CIF" | "FOB")
              : "CFR",
          description: existing.description ?? "",
          images: existing.images ?? [],
        }
      : {
          category_id: "",
          title: "",
          specs: {},
          // Leave undefined so the input renders empty rather than "1"; the
          // zod schema (required positive) still catches submit without a value.
          quantity: undefined as unknown as number,
          min_order_quantity: undefined,
          unit: "MT",
          origin_location: "Madagascar",
          available_from: "",
          available_to: "",
          unit_price: undefined as unknown as number,
          currency: "USDT",
          incoterm: "CFR",
          description: "",
          images: [],
        },
  });

  const categoryId = form.watch("category_id");
  const selected = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId]
  );
  const selectedSpec: CategorySpec | null = useMemo(
    () => (selected ? parseCategorySpec(selected.spec_schema) : null),
    [selected]
  );

  // Live spec overrides + qty drive the suggested title.
  const watchedSpecs = form.watch("specs");
  const watchedQty = form.watch("quantity");
  const watchedUnit = form.watch("unit");
  const suggestedTitle = useMemo(() => {
    if (!selected || !selectedSpec) return "";
    return buildListingTitle({
      categoryName: selected.name,
      categorySpec: selectedSpec,
      overrides: watchedSpecs ?? {},
      quantity:
        typeof watchedQty === "number" && Number.isFinite(watchedQty)
          ? watchedQty
          : null,
      unit: watchedUnit ?? null,
    });
  }, [selected, selectedSpec, watchedSpecs, watchedQty, watchedUnit]);

  // Custom Grade renders mesh as a checkbox grid (array values); standard
  // categories keep the single-select dropdown.
  const customMeshValue: MeshSize[] = useMemo(() => {
    const v = watchedSpecs?.mesh_size;
    if (Array.isArray(v)) return v;
    if (typeof v === "string") return [v];
    return [];
  }, [watchedSpecs?.mesh_size]);

  function applySuggestedTitle() {
    if (suggestedTitle) {
      form.setValue("title", suggestedTitle, { shouldValidate: true });
      setTitleEdited(true); // future blur events won't auto-fill
    }
  }

  function onSubmit(values: ListingInput) {
    // For custom-grade categories the seller must specify at least one mesh size.
    if (selectedSpec?.is_custom) {
      const ms = values.specs?.mesh_size;
      const hasMesh =
        (Array.isArray(ms) && ms.length > 0) ||
        (typeof ms === "string" && ms.length > 0);
      if (!hasMesh) {
        form.setError("specs.mesh_size", {
          message: t("fields.meshRequired"),
        });
        return;
      }
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateListing(existing.id, values)
        : await createListing(values);
      if (result.error) {
        if (result.error.fieldErrors) {
          for (const [field, messages] of Object.entries(
            result.error.fieldErrors
          )) {
            const msg = Array.isArray(messages) ? messages[0] : messages;
            if (msg)
              form.setError(field as keyof ListingInput, {
                message: String(msg),
              });
          }
        }
        if (result.error.code === "PROFILE_INCOMPLETE") {
          toast.error(result.error.message, {
            duration: 8000,
            action: {
              label: t("toast.openSettings"),
              onClick: () => router.push("/settings?prompt=incomplete"),
            },
          });
        } else if (result.error.code === "KYC_REQUIRED") {
          toast.error(result.error.message, {
            duration: 8000,
            action: {
              label: t("toast.kycPage"),
              onClick: () => router.push("/settings/kyc"),
            },
          });
        } else {
          toast.error(result.error.message);
        }
        return;
      }
      toast.success(isEdit ? t("toast.updated") : t("toast.created"));
      router.push("/listings");
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 max-w-2xl"
      >
        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("fields.category")}</FormLabel>
              <Select
                onValueChange={(v) => {
                  field.onChange(v);
                  // Reset spec overrides whenever the category changes so
                  // we don't carry +35 mesh into a -100 mesh listing, etc.
                  form.setValue("specs", {});
                }}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    {/*
                      Render the selected category's *name* instead of the
                      raw UUID. base-ui's Select.Value falls back to
                      serializeValue(value) when no children/items map is
                      provided, which is why the trigger previously showed
                      a UUID. Passing a render function fixes it.
                    */}
                    <SelectValue placeholder={t("fields.categoryPlaceholder")}>
                      {(value: unknown) => {
                        const id =
                          typeof value === "string" ? value : "";
                        const match = categories.find((c) => c.id === id);
                        return match
                          ? match.name
                          : t("fields.categoryPlaceholder");
                      }}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((c) => {
                    const spec = parseCategorySpec(c.spec_schema);
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="font-medium">{c.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {describeCategorySpec(spec)}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedSpec && (
                <div className="mt-2 rounded-md border bg-card/40 p-3 text-xs space-y-1">
                  <p>
                    <span className="text-muted-foreground">
                      {t("categoryCard.productType")}
                    </span>{" "}
                    <span className="font-medium">
                      {PRODUCT_TYPE_LABEL[selectedSpec.product_type]}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">
                      {t("categoryCard.defaultSpec")}
                    </span>{" "}
                    <span className="font-medium">
                      {describeCategorySpec(selectedSpec)}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    {t("categoryCard.rangeNote", {
                      pct: selectedSpec.size_distribution_min_pct,
                    })}
                  </p>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>{t("fields.title")}</FormLabel>
                {selectedSpec && suggestedTitle && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={applySuggestedTitle}
                  >
                    {t("fields.generateTitle")}
                  </Button>
                )}
              </div>
              <FormControl>
                <Input
                  placeholder={suggestedTitle || t("fields.titlePlaceholder")}
                  {...field}
                  onChange={(e) => {
                    setTitleEdited(true);
                    field.onChange(e);
                  }}
                  onBlur={(e) => {
                    if (!titleEdited && !e.target.value && suggestedTitle) {
                      form.setValue("title", suggestedTitle, {
                        shouldValidate: true,
                      });
                    }
                    field.onBlur();
                  }}
                />
              </FormControl>
              {selectedSpec && suggestedTitle && !field.value && (
                <p className="text-xs text-muted-foreground">
                  {t("fields.suggested")}
                  <span className="text-foreground">{suggestedTitle}</span>
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedSpec && (
          <div className="rounded-md border bg-card/30 p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">
                {t("fields.specsHeading")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {selectedSpec.is_custom
                  ? t("fields.specsHintCustom")
                  : t("fields.specsHintInherited")}
              </p>
            </div>

            {/* Mesh size — single dropdown for standard, multi-select grid for custom. */}
            {selectedSpec.is_custom ? (
              <Controller
                control={form.control}
                name="specs.mesh_size"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>
                      {t("fields.meshSizesLabel")}
                      <span className="text-destructive ml-1">*</span>
                    </FormLabel>
                    <div className="grid grid-cols-3 gap-2">
                      {MESH_SIZES.map((m) => {
                        const isChecked = customMeshValue.includes(m);
                        return (
                          <label
                            key={m}
                            className={cn(
                              "flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors",
                              isChecked
                                ? "border-primary bg-primary/10"
                                : "border-border hover:bg-muted/50"
                            )}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                const next = new Set(customMeshValue);
                                if (checked) next.add(m);
                                else next.delete(m);
                                const arr = Array.from(next);
                                field.onChange(arr.length > 0 ? arr : undefined);
                              }}
                              aria-label={t("fields.meshAria", { value: m })}
                            />
                            <span>{t("fields.meshSuffix", { value: m })}</span>
                          </label>
                        );
                      })}
                    </div>
                    {customMeshValue.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("fields.meshSelection", {
                          value: formatMeshSelection(customMeshValue),
                        })}
                      </p>
                    )}
                    {fieldState.error?.message && (
                      <p className="text-xs text-destructive">
                        {fieldState.error.message}
                      </p>
                    )}
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="specs.mesh_size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.meshSizeLabel")}</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v)}
                      value={
                        typeof field.value === "string" ? field.value : ""
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              selectedSpec.mesh_size
                                ? t("fields.meshDefault", {
                                    value: selectedSpec.mesh_size,
                                  })
                                : t("fields.meshPick")
                            }
                          >
                            {(value: unknown) =>
                              typeof value === "string" && value
                                ? t("fields.meshSuffix", { value })
                                : selectedSpec.mesh_size
                                  ? t("fields.meshDefault", {
                                      value: selectedSpec.mesh_size,
                                    })
                                  : t("fields.meshPick")
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MESH_SIZES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {t("fields.meshSuffix", { value: m })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="specs.fixed_carbon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.fixedCarbon")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={
                          selectedSpec.is_custom
                            ? t("fields.fixedCarbonPlaceholderCustom")
                            : t("fields.fixedCarbonPlaceholderInherit", {
                                min: selectedSpec.fixed_carbon_min,
                                max: selectedSpec.fixed_carbon_max,
                              })
                        }
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {t.rich("fields.fixedCarbonHelp", {
                        0: (chunks) => (
                          <span className="text-foreground">{chunks}</span>
                        ),
                      })}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="specs.moisture"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.moisture")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("fields.moisturePlaceholder", {
                          max: selectedSpec.moisture_max,
                        })}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="specs.size_distribution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.sizeDistribution")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("fields.sizeDistributionPlaceholder", {
                        value: selectedSpec.size_distribution_min_pct,
                      })}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="specs.additional_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.additionalNotes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder={t("fields.additionalNotesPlaceholder")}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t("fields.additionalNotesHelp")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("fields.quantity")}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0.001}
                    step={0.001}
                    placeholder={t("fields.quantityPlaceholder")}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      field.onChange(v === "" ? undefined : parseFloat(v));
                    }}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  {t("fields.quantityHelp")}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("fields.unit")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue>
                        {(value: unknown) =>
                          value === "KG"
                            ? tEnums("unit.KG")
                            : tEnums("unit.MT")
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="MT">{tEnums("unit.MT")}</SelectItem>
                    <SelectItem value="KG">{tEnums("unit.KG")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="min_order_quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("fields.minOrder")}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0.001}
                  step={0.001}
                  placeholder={t("fields.minOrderPlaceholder")}
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    field.onChange(v === "" ? undefined : parseFloat(v));
                  }}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                {t("fields.minOrderHelp")}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="unit_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("fields.unitPrice")}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder={t("fields.unitPricePlaceholder")}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      field.onChange(v === "" ? undefined : parseFloat(v));
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("fields.currency")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {["USDT", "USDI", "MUP", "USD", "EUR"].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="incoterm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("fields.incoterm")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {["CFR", "CIF", "FOB"].map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
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
            name="origin_location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("fields.origin")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("fields.originPlaceholder")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="available_from"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("fields.availableFrom")}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="available_to"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("fields.availableTo")}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="images"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("fields.images")}</FormLabel>
              <FormControl>
                <ListingImageUploader
                  value={field.value ?? []}
                  onChange={(urls) => field.onChange(urls)}
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
              <FormLabel>{t("fields.description")}</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder={t("fields.descriptionPlaceholder")}
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                {t("fields.descriptionHelp")}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending
              ? isEdit
                ? t("actions.saving")
                : t("actions.creating")
              : isEdit
                ? t("actions.save")
                : t("actions.create")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            {t("actions.cancel")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
