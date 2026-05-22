"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  PRODUCT_TYPE_LABEL,
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
      toast.success(existing ? "Category updated." : "Category created.");
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
            Edit
          </>
        ) : (
          <>
            <PlusIcon className="w-4 h-4 mr-2" />
            New Category
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit Category" : "New Category"}
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
                  <FormLabel>Category Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Flake Graphite +100 Mesh"
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="One-sentence summary shown to buyers."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-md border bg-card/40 p-3 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Specification defaults
              </p>

              <FormField
                control={form.control}
                name="spec_schema.product_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          {/* Render the human label, not the enum code. */}
                          <SelectValue>
                            {(value: unknown) =>
                              typeof value === "string" && value in PRODUCT_TYPE_LABEL
                                ? PRODUCT_TYPE_LABEL[value as keyof typeof PRODUCT_TYPE_LABEL]
                                : "Select product type"
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRODUCT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {PRODUCT_TYPE_LABEL[t]}
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
                        Custom grade
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Seller fills in mesh size and exact values per listing.
                      </p>
                    </div>
                    <FormControl>
                      <Button
                        type="button"
                        size="sm"
                        variant={field.value ? "default" : "outline"}
                        onClick={() => field.onChange(!field.value)}
                      >
                        {field.value ? "Custom" : "Standard"}
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
                      <FormLabel>Mesh Size</FormLabel>
                      <Select
                        onValueChange={(v) =>
                          field.onChange(v === MESH_NONE ? null : v)
                        }
                        value={field.value ?? MESH_NONE}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select mesh size">
                              {(value: unknown) =>
                                typeof value === "string" && value && value !== MESH_NONE
                                  ? `${value} Mesh`
                                  : "Select mesh size"
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
                      <p className="text-xs text-muted-foreground">
                        e.g. <span className="text-foreground">+100</span> means ≥80% of particles
                        retained on a 100-mesh screen.{" "}
                        <span className="text-foreground">-100</span> means ≥80% pass through it.
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
                      <FormLabel>Fixed Carbon Min (%)</FormLabel>
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
                      <FormLabel>Fixed Carbon Max (%)</FormLabel>
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
                      <FormLabel>Moisture Max (%)</FormLabel>
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
                      <FormLabel>Size Distribution Min (%)</FormLabel>
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
                        Default 80 — i.e. 80% MIN on the mesh.
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
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
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
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCategory(categoryId);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Category deactivated.");
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
      Deactivate
    </Button>
  );
}

export function ReactivateCategoryButton({
  categoryId,
}: {
  categoryId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleReactivate() {
    startTransition(async () => {
      const result = await reactivateCategory(categoryId);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Category reactivated.");
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
      Reactivate
    </Button>
  );
}
