"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
  describeCategorySpec,
  parseCategorySpec,
  type CategorySpec,
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

  const form = useForm<ListingInput>({
    resolver: zodResolver(ListingInputSchema) as never,
    defaultValues: {
      category_id: "",
      title: "",
      specs: {},
      quantity: 1,
      unit: "MT",
      origin_location: "Madagascar",
      available_from: "",
      available_to: "",
      unit_price: 0,
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

  function onSubmit(values: ListingInput) {
    // For custom-grade categories the seller must specify a mesh size.
    if (selectedSpec?.is_custom && !values.specs.mesh_size) {
      form.setError("specs.mesh_size", {
        message: "Mesh size is required for custom grade.",
      });
      return;
    }

    startTransition(async () => {
      const result = await createListing(values);
      if (result.error) {
        if (result.error.fieldErrors) {
          for (const [field, messages] of Object.entries(result.error.fieldErrors)) {
            const msg = Array.isArray(messages) ? messages[0] : messages;
            if (msg) form.setError(field as keyof ListingInput, { message: String(msg) });
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
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
                    <SelectValue placeholder="Select a product category" />
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
                    ≥ {selectedSpec.size_distribution_min_pct}% of particles match the mesh.
                    Override any field below if your batch differs.
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
              <FormLabel>Listing Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Natural Flake Graphite 95% C — 50 MT" {...field} />
              </FormControl>
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
                  ? "Custom grade — please fill in all spec fields below."
                  : "Inherited from category. Leave empty to use defaults, or override to match your batch."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="specs.mesh_size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Mesh Size
                      {selectedSpec.is_custom && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              selectedSpec.is_custom
                                ? "Pick mesh size"
                                : selectedSpec.mesh_size
                                  ? `Default: ${selectedSpec.mesh_size}`
                                  : "Pick mesh size"
                            }
                          />
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
                            ? "e.g. 95"
                            : `Default: ${selectedSpec.fixed_carbon_min}–${selectedSpec.fixed_carbon_max}`
                        }
                        {...field}
                        value={field.value ?? ""}
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
            </div>

            <FormField
              control={form.control}
              name="specs.additional_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Anything else buyers should know about this batch — e.g. ash content, sulphur, packing."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
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
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0.001}
                    step={0.001}
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
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
                      <SelectValue />
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
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
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
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="Additional details about quality, packaging, certificates..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create Listing"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
