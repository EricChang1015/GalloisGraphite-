"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, PencilIcon } from "lucide-react";

import { CategoryInputSchema } from "@/lib/validations/admin";
import { upsertCategory, deleteCategory } from "@/actions/admin";
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

type CategoryInput = z.infer<typeof CategoryInputSchema>;

interface Category {
  id: string;
  name: string;
  description: string | null;
  spec_schema: Record<string, unknown>;
  is_active: boolean;
}

interface CategoryFormProps {
  existing?: Category;
}

export function CategoryFormDialog({ existing }: CategoryFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<CategoryInput>({
    resolver: zodResolver(CategoryInputSchema) as never,
    defaultValues: {
      id: existing?.id,
      name: existing?.name ?? "",
      description: existing?.description ?? "",
      spec_schema: existing?.spec_schema ?? {},
      is_active: existing?.is_active ?? true,
    },
  });

  // We store spec_schema as a JSON string in a textarea
  const [specJson, setSpecJson] = useState(
    JSON.stringify(existing?.spec_schema ?? {}, null, 2)
  );
  const [specError, setSpecError] = useState("");

  function onSubmit(values: CategoryInput) {
    let spec: Record<string, unknown> = {};
    try {
      spec = JSON.parse(specJson);
      setSpecError("");
    } catch {
      setSpecError("Invalid JSON");
      return;
    }

    startTransition(async () => {
      const result = await upsertCategory({ ...values, spec_schema: spec });
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
          <><PencilIcon className="w-3 h-3 mr-1" />Edit</>
        ) : (
          <><PlusIcon className="w-4 h-4 mr-2" />New Category</>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Category" : "New Category"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Natural Flake Graphite" {...field} />
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
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <label className="text-sm font-medium">Spec Schema (JSON)</label>
              <Textarea
                rows={5}
                value={specJson}
                onChange={(e) => setSpecJson(e.target.value)}
                className="font-mono text-xs mt-1"
                placeholder='{"carbon_content": "string", "particle_size": "string"}'
              />
              {specError && <p className="text-destructive text-xs mt-1">{specError}</p>}
              <p className="text-xs text-muted-foreground mt-1">
                Define the spec fields buyers/sellers must fill in for this category.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
      if (result.error) { toast.error(result.error.message); return; }
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
