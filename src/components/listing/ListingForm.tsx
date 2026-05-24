"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createListing } from "@/actions/listing";
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

interface ListingFormProps {
  categories: CategoryOption[];
}

export function ListingForm({ categories }: ListingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  /** Track whether the seller has manually edited the title so we don't
   *  clobber their text on auto-fill. */
  const [titleEdited, setTitleEdited] = useState(false);

  const form = useForm<ListingInput>({
    resolver: zodResolver(ListingInputSchema) as never,
    defaultValues: {
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
          message: "Pick at least one mesh size for custom grade.",
        });
        return;
      }
    }

    startTransition(async () => {
      const result = await createListing(values);
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
              label: "Open Settings",
              onClick: () => router.push("/settings?prompt=incomplete"),
            },
          });
        } else if (result.error.code === "KYC_REQUIRED") {
          toast.error(result.error.message, {
            duration: 8000,
            action: {
              label: "KYC page",
              onClick: () => router.push("/settings/kyc"),
            },
          });
        } else {
          toast.error(result.error.message);
        }
        return;
      }
      toast.success("Listing created successfully.");
      router.push("/listings");
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
              <FormLabel>Category</FormLabel>
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
                    <SelectValue placeholder="Select a product category">
                      {(value: unknown) => {
                        const id =
                          typeof value === "string" ? value : "";
                        const match = categories.find((c) => c.id === id);
                        return match
                          ? match.name
                          : "Select a product category";
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
                    <span className="text-muted-foreground">Product type:</span>{" "}
                    <span className="font-medium">
                      {PRODUCT_TYPE_LABEL[selectedSpec.product_type]}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Default spec:</span>{" "}
                    <span className="font-medium">
                      {describeCategorySpec(selectedSpec)}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    ≥ {selectedSpec.size_distribution_min_pct}% of particles
                    match the mesh. Override any field below if your batch
                    differs.
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
                <FormLabel>Listing Title</FormLabel>
                {selectedSpec && suggestedTitle && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={applySuggestedTitle}
                  >
                    Generate title
                  </Button>
                )}
              </div>
              <FormControl>
                <Input
                  placeholder={
                    suggestedTitle ||
                    "e.g. Natural Flake Graphite 95% C — 50 MT"
                  }
                  {...field}
                  onChange={(e) => {
                    setTitleEdited(true);
                    field.onChange(e);
                  }}
                  onBlur={(e) => {
                    // If the seller never edited the title and the field
                    // is still empty, fill in the suggestion on blur.
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
                  Suggested:{" "}
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
              <h3 className="text-sm font-semibold">Product Specifications</h3>
              <p className="text-xs text-muted-foreground">
                {selectedSpec.is_custom
                  ? "Custom grade — pick every mesh size that applies and fill in any spec ranges (e.g. 90–95% fixed carbon)."
                  : "Inherited from category. Leave a field empty to use the category default, or override it to match your batch."}
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
                      Mesh Size(s)
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
                              aria-label={`${m} mesh`}
                            />
                            <span>{m} Mesh</span>
                          </label>
                        );
                      })}
                    </div>
                    {customMeshValue.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Selection: {formatMeshSelection(customMeshValue)}
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
                    <FormLabel>Mesh Size</FormLabel>
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
                                ? `Default: ${selectedSpec.mesh_size} Mesh`
                                : "Pick mesh size"
                            }
                          >
                            {(value: unknown) =>
                              typeof value === "string" && value
                                ? `${value} Mesh`
                                : selectedSpec.mesh_size
                                  ? `Default: ${selectedSpec.mesh_size} Mesh`
                                  : "Pick mesh size"
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MESH_SIZES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m} Mesh
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
                    <FormLabel>Fixed Carbon (%)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={
                          selectedSpec.is_custom
                            ? "e.g. 95 or 90-95"
                            : `Default: ${selectedSpec.fixed_carbon_min}–${selectedSpec.fixed_carbon_max}`
                        }
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Accepts a single number or range — e.g. <span className="text-foreground">94</span>, <span className="text-foreground">90-95</span>, <span className="text-foreground">≥95</span>.
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
                    <FormLabel>Moisture (%)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={`Default: ${selectedSpec.moisture_max}% max`}
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
                  <FormLabel>Size Distribution</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={`Default: ${selectedSpec.size_distribution_min_pct}% min`}
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
                  <FormLabel>Additional Spec Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Spec-related context: ash content, sulphur, packing, COA references…"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Shown in the buyer's spec sheet. For batch logistics
                    or commercial terms, use the Description field below.
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
                <FormLabel>Available Quantity *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0.001}
                    step={0.001}
                    placeholder="e.g. 50"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      field.onChange(v === "" ? undefined : parseFloat(v));
                    }}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Total amount you can ship from this lot.
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
                <FormLabel>Unit</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue>
                        {(value: unknown) =>
                          value === "KG"
                            ? "KG (Kilogram)"
                            : "MT (Metric Ton)"
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="MT">MT (Metric Ton)</SelectItem>
                    <SelectItem value="KG">KG (Kilogram)</SelectItem>
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
              <FormLabel>Minimum Order Quantity (optional)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0.001}
                  step={0.001}
                  placeholder="e.g. 5 — leave blank for no minimum"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    field.onChange(v === "" ? undefined : parseFloat(v));
                  }}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                The smallest order a buyer can submit through inquiry.
                Empty = any quantity is OK. Cannot exceed available quantity.
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
                <FormLabel>Unit Price</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="e.g. 850.00"
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
                <FormLabel>Currency</FormLabel>
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
                <FormLabel>Incoterm</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {["CFR", "CIF", "FOB"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
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
                <FormLabel>Origin</FormLabel>
                <FormControl>
                  <Input placeholder="Madagascar" {...field} />
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
                <FormLabel>Available From (optional)</FormLabel>
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
                <FormLabel>Available To (optional)</FormLabel>
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
              <FormLabel>Images (optional)</FormLabel>
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
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="Commercial / logistics context: packaging, certificates, delivery options, payment preferences…"
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Free-form pitch shown beneath the spec sheet on the
                listing page.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create Listing"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
