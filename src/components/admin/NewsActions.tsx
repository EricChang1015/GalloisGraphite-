"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, PencilIcon } from "lucide-react";
import type { z } from "zod";

import { NewsInputSchema } from "@/lib/validations/admin";
import { upsertNews } from "@/actions/admin";
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

type NewsInput = z.infer<typeof NewsInputSchema>;

interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content_html: string | null;
  cover_image_url: string | null;
  is_published: boolean;
}

export function NewsFormDialog({ existing }: { existing?: NewsArticle }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<NewsInput>({
    resolver: zodResolver(NewsInputSchema) as never,
    defaultValues: {
      id: existing?.id,
      title: existing?.title ?? "",
      slug: existing?.slug ?? "",
      summary: existing?.summary ?? "",
      content_html: existing?.content_html ?? "",
      cover_image_url: existing?.cover_image_url ?? "",
      is_published: existing?.is_published ?? false,
    },
  });

  function onSubmit(values: NewsInput) {
    startTransition(async () => {
      const result = await upsertNews(values);
      if (result.error) { toast.error(result.error.message); return; }
      toast.success(existing ? "Article updated." : "Article created.");
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
          <><PlusIcon className="w-4 h-4 mr-2" />New Article</>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Article" : "New Article"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl><Input placeholder="my-article-slug" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cover_image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cover Image URL (optional)</FormLabel>
                  <FormControl><Input type="url" placeholder="https://..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Summary</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="content_html"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content (HTML)</FormLabel>
                  <FormControl><Textarea rows={8} className="font-mono text-xs" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_published"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Publish immediately</FormLabel>
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
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
