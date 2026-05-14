"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DocumentUploadSchema,
  VerifyDocumentSchema,
  type DocumentUploadInput,
} from "@/lib/validations/document";
import type { ActionResult } from "./auth";
import type { Json } from "@/types/database";

export { DocumentUploadSchema, VerifyDocumentSchema };

/**
 * Record an order document. The actual file upload to Supabase Storage is
 * performed client-side; this action only persists the metadata row.
 */
export async function uploadOrderDocument(
  input: DocumentUploadInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = DocumentUploadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { message: "Invalid input.", fieldErrors: z.flattenError(parsed.error).fieldErrors },
    };
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: order } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id")
    .eq("id", parsed.data.order_id)
    .single<{ id: string; buyer_id: string; seller_id: string }>();
  if (!order) return { data: null, error: { message: "Order not found." } };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

  if (order.buyer_id !== user.id && order.seller_id !== user.id && !isAdmin) {
    return { data: null, error: { message: "Access denied." } };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("order_documents")
    .insert({
      order_id: parsed.data.order_id,
      type: parsed.data.type,
      file_url: parsed.data.file_url,
      file_name: parsed.data.file_name ?? null,
      file_size_bytes: parsed.data.file_size_bytes ?? null,
      mime_type: parsed.data.mime_type ?? null,
      uploaded_by: user.id,
      metadata: parsed.data.metadata as Json,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { data: null, error: { message: error.message } };

  // Append to order timeline
  const { data: orderRow } = await admin
    .from("orders")
    .select("timeline")
    .eq("id", parsed.data.order_id)
    .single<{ timeline: unknown[] }>();
  const events = Array.isArray(orderRow?.timeline) ? orderRow.timeline : [];
  await admin
    .from("orders")
    .update({
      timeline: [
        ...events,
        {
          event: "document_uploaded",
          at: new Date().toISOString(),
          by: user.id,
          document_type: parsed.data.type,
          document_id: data.id,
        },
      ] as Json,
    })
    .eq("id", parsed.data.order_id);

  revalidatePath(`/orders/${parsed.data.order_id}`);
  return { data: { id: data.id }, error: null };
}

/** Admin marks an uploaded document as verified. */
export async function verifyOrderDocument(
  input: z.infer<typeof VerifyDocumentSchema>
): Promise<ActionResult<true>> {
  const parsed = VerifyDocumentSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return { data: null, error: { message: "Admin access required." } };
  }

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("order_documents")
    .select("order_id, type")
    .eq("id", parsed.data.document_id)
    .single<{ order_id: string; type: string }>();
  if (!doc) return { data: null, error: { message: "Document not found." } };

  const { error } = await admin
    .from("order_documents")
    .update({
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      admin_note: parsed.data.note ?? null,
    })
    .eq("id", parsed.data.document_id);
  if (error) return { data: null, error: { message: error.message } };

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "verify_document",
    target_type: "order_document",
    target_id: parsed.data.document_id,
    metadata: { order_id: doc.order_id, document_type: doc.type, note: parsed.data.note } as Json,
  });

  revalidatePath(`/orders/${doc.order_id}`);
  return { data: true, error: null };
}

/** Uploader can withdraw within 1 hour while the row is unverified. */
export async function deleteOrderDocument(
  documentId: string
): Promise<ActionResult<true>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("order_documents")
    .select("id, order_id, uploaded_by, uploaded_at, verified_by")
    .eq("id", documentId)
    .single<{
      id: string;
      order_id: string;
      uploaded_by: string;
      uploaded_at: string;
      verified_by: string | null;
    }>();
  if (!doc) return { data: null, error: { message: "Document not found." } };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

  const ageMs = Date.now() - new Date(doc.uploaded_at).getTime();
  const oneHour = 60 * 60 * 1000;
  if (!isAdmin) {
    if (doc.uploaded_by !== user.id) {
      return { data: null, error: { message: "Access denied." } };
    }
    if (doc.verified_by) {
      return { data: null, error: { message: "Verified documents cannot be removed." } };
    }
    if (ageMs > oneHour) {
      return { data: null, error: { message: "Withdraw window (1h) has passed." } };
    }
  }

  const { error } = await admin.from("order_documents").delete().eq("id", documentId);
  if (error) return { data: null, error: { message: error.message } };

  revalidatePath(`/orders/${doc.order_id}`);
  return { data: true, error: null };
}
