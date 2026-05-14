"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import {
  QuotationInputSchema,
  CounterQuotationSchema,
  RejectQuotationSchema,
  type QuotationInput,
  type CounterQuotationInput,
} from "@/lib/validations/quotation";
import type { ActionResult } from "./auth";
import type { Json } from "@/types/database";

export {
  QuotationInputSchema,
  CounterQuotationSchema,
  RejectQuotationSchema,
};

/** Append a generic timeline event to an order. */
async function appendOrderTimeline(
  orderId: string,
  event: string,
  actorId: string,
  meta?: Record<string, unknown>
) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select("timeline")
    .eq("id", orderId)
    .single<{ timeline: unknown[] }>();
  const timeline = Array.isArray(data?.timeline) ? data.timeline : [];
  const entry = { event, at: new Date().toISOString(), by: actorId, ...meta };
  await admin
    .from("orders")
    .update({ timeline: [...timeline, entry] as Json })
    .eq("id", orderId);
}

/**
 * Seller responds to an inquiry with a structured offer. Marks any prior
 * quotations on the same inquiry as `superseded` so only one is "live".
 */
export async function submitQuotation(
  input: QuotationInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = QuotationInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { message: "Invalid input.", fieldErrors: z.flattenError(parsed.error).fieldErrors },
    };
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single<{ role: string; status: string }>();

  if (!profile || profile.status !== "active") {
    return { data: null, error: { message: "Account not active." } };
  }
  if (profile.role !== "seller" && profile.role !== "admin" && profile.role !== "super_admin") {
    return { data: null, error: { message: "Only sellers can submit quotations." } };
  }

  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("id, buyer_id, seller_id, listing_id, status")
    .eq("id", parsed.data.inquiry_id)
    .single<{ id: string; buyer_id: string; seller_id: string; listing_id: string | null; status: string }>();

  if (!inquiry) return { data: null, error: { message: "Inquiry not found." } };
  if (inquiry.seller_id !== user.id && profile.role === "seller") {
    return { data: null, error: { message: "Access denied." } };
  }
  if (inquiry.status === "rejected" || inquiry.status === "expired" || inquiry.status === "converted") {
    return { data: null, error: { message: `Inquiry is ${inquiry.status}.` } };
  }

  const admin = createAdminClient();

  // Mark prior live quotations on this inquiry as superseded
  await admin
    .from("quotations")
    .update({ status: "superseded" })
    .eq("inquiry_id", parsed.data.inquiry_id)
    .in("status", ["sent", "countered"]);

  const { data: quotation, error } = await admin
    .from("quotations")
    .insert({
      inquiry_id: parsed.data.inquiry_id,
      seller_id: user.id,
      buyer_id: inquiry.buyer_id,
      listing_id: parsed.data.listing_id ?? inquiry.listing_id,
      unit_price: parsed.data.unit_price,
      currency: parsed.data.currency,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      incoterm: parsed.data.incoterm,
      origin_port: parsed.data.origin_port ?? null,
      destination_port: parsed.data.destination_port ?? null,
      validity_until: parsed.data.validity_until,
      specs_confirmed: parsed.data.specs_confirmed as Json,
      shipping_window_from: parsed.data.shipping_window_from ?? null,
      shipping_window_to: parsed.data.shipping_window_to ?? null,
      notes: parsed.data.notes ?? null,
      status: "sent",
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { data: null, error: { message: error.message } };

  // Update inquiry status to 'quoted'
  await admin.from("inquiries").update({ status: "quoted" }).eq("id", parsed.data.inquiry_id);

  // Notify buyer
  try {
    const { data: buyer } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", inquiry.buyer_id)
      .single<{ email: string; full_name: string }>();
    if (buyer?.email) {
      await sendEmail({
        to: buyer.email,
        subject: "New quotation received — Mada Graphite",
        html: `
          <p>Hi ${buyer.full_name || "Buyer"},</p>
          <p>You have received a new quotation: <strong>${parsed.data.quantity} ${parsed.data.unit}</strong> @
             <strong>${parsed.data.unit_price} ${parsed.data.currency}</strong> (${parsed.data.incoterm}).</p>
          <p>Valid until: <strong>${parsed.data.validity_until}</strong></p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/inquiries/${parsed.data.inquiry_id}">Review quotation</a></p>
        `,
      });
    }
  } catch (_) {}

  revalidatePath(`/inquiries/${parsed.data.inquiry_id}`);
  revalidatePath("/inquiries");

  return { data: { id: quotation.id }, error: null };
}

/**
 * Either party may propose a counter-offer. Marks the parent quotation as
 * `countered` and inserts a fresh quotation row referencing the parent.
 */
export async function counterQuotation(
  input: CounterQuotationInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = CounterQuotationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { message: "Invalid input.", fieldErrors: z.flattenError(parsed.error).fieldErrors },
    };
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: parent } = await supabase
    .from("quotations")
    .select("id, inquiry_id, buyer_id, seller_id, status")
    .eq("id", parsed.data.parent_quotation_id)
    .single<{ id: string; inquiry_id: string; buyer_id: string; seller_id: string; status: string }>();

  if (!parent) return { data: null, error: { message: "Parent quotation not found." } };
  if (user.id !== parent.buyer_id && user.id !== parent.seller_id) {
    return { data: null, error: { message: "Access denied." } };
  }
  if (parent.status !== "sent" && parent.status !== "countered") {
    return { data: null, error: { message: `Cannot counter a ${parent.status} quotation.` } };
  }

  const admin = createAdminClient();

  // Mark parent as countered
  await admin
    .from("quotations")
    .update({ status: "countered", countered_by: user.id, responded_at: new Date().toISOString() })
    .eq("id", parent.id);

  // Insert new counter quotation
  const { data: counter, error } = await admin
    .from("quotations")
    .insert({
      inquiry_id: parent.inquiry_id,
      parent_quotation_id: parent.id,
      seller_id: parent.seller_id,
      buyer_id: parent.buyer_id,
      listing_id: parsed.data.listing_id ?? null,
      unit_price: parsed.data.unit_price,
      currency: parsed.data.currency,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      incoterm: parsed.data.incoterm,
      origin_port: parsed.data.origin_port ?? null,
      destination_port: parsed.data.destination_port ?? null,
      validity_until: parsed.data.validity_until,
      specs_confirmed: parsed.data.specs_confirmed as Json,
      shipping_window_from: parsed.data.shipping_window_from ?? null,
      shipping_window_to: parsed.data.shipping_window_to ?? null,
      notes: parsed.data.notes ?? null,
      status: "sent",
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { data: null, error: { message: error.message } };

  await admin.from("inquiries").update({ status: "negotiating" }).eq("id", parent.inquiry_id);

  revalidatePath(`/inquiries/${parent.inquiry_id}`);

  return { data: { id: counter.id }, error: null };
}

/**
 * Buyer accepts a quotation → creates an order in `contract_pending` state
 * (waiting for seller to draft contract). Marks inquiry as `converted`.
 */
export async function acceptQuotation(
  quotationId: string
): Promise<ActionResult<{ orderId: string }>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: q } = await supabase
    .from("quotations")
    .select(
      "id, inquiry_id, buyer_id, seller_id, listing_id, unit_price, currency, quantity, incoterm, destination_port, status, validity_until"
    )
    .eq("id", quotationId)
    .single<{
      id: string;
      inquiry_id: string | null;
      buyer_id: string;
      seller_id: string;
      listing_id: string | null;
      unit_price: number;
      currency: string;
      quantity: number;
      incoterm: string;
      destination_port: string | null;
      status: string;
      validity_until: string;
    }>();

  if (!q) return { data: null, error: { message: "Quotation not found." } };
  if (q.buyer_id !== user.id) {
    return { data: null, error: { message: "Only the buyer can accept this quotation." } };
  }
  if (q.status !== "sent") {
    return { data: null, error: { message: `Quotation is ${q.status}.` } };
  }
  if (new Date(q.validity_until) < new Date()) {
    return { data: null, error: { message: "Quotation has expired." } };
  }
  if (!q.listing_id) {
    return { data: null, error: { message: "Quotation must reference a listing to create an order." } };
  }

  const admin = createAdminClient();
  const total = q.unit_price * q.quantity;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      buyer_id: q.buyer_id,
      seller_id: q.seller_id,
      listing_id: q.listing_id,
      inquiry_id: q.inquiry_id,
      current_quotation_id: q.id,
      quantity: q.quantity,
      unit_price: q.unit_price,
      total_amount: total,
      currency: q.currency,
      destination: q.destination_port,
      status: "contract_pending",
      timeline: [
        { event: "quotation_accepted", at: new Date().toISOString(), by: user.id, quotation_id: q.id },
      ] as Json,
    })
    .select("id")
    .single<{ id: string }>();

  if (orderError) return { data: null, error: { message: orderError.message } };

  // Mark quotation accepted
  await admin
    .from("quotations")
    .update({ status: "accepted", responded_at: new Date().toISOString(), countered_by: user.id })
    .eq("id", q.id);

  // Mark inquiry converted
  if (q.inquiry_id) {
    await admin.from("inquiries").update({ status: "converted" }).eq("id", q.inquiry_id);
  }

  // Notify seller to draft contract
  try {
    const { data: seller } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", q.seller_id)
      .single<{ email: string; full_name: string }>();
    if (seller?.email) {
      await sendEmail({
        to: seller.email,
        subject: "Quotation accepted — please draft the contract",
        html: `
          <p>Hi ${seller.full_name || "Seller"},</p>
          <p>The buyer has accepted your quotation. Please proceed to draft the sales contract.</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.id}">Open order</a></p>
        `,
      });
    }
  } catch (_) {}

  revalidatePath("/inquiries");
  revalidatePath("/orders");

  return { data: { orderId: order.id }, error: null };
}

/** Either party rejects an open quotation. */
export async function rejectQuotation(
  input: z.infer<typeof RejectQuotationSchema>
): Promise<ActionResult<true>> {
  const parsed = RejectQuotationSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: { message: "Invalid input." } };
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: q } = await supabase
    .from("quotations")
    .select("id, inquiry_id, buyer_id, seller_id, status")
    .eq("id", parsed.data.quotation_id)
    .single<{ id: string; inquiry_id: string | null; buyer_id: string; seller_id: string; status: string }>();

  if (!q) return { data: null, error: { message: "Quotation not found." } };
  if (q.buyer_id !== user.id && q.seller_id !== user.id) {
    return { data: null, error: { message: "Access denied." } };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("quotations")
    .update({
      status: "rejected",
      countered_by: user.id,
      responded_at: new Date().toISOString(),
      notes: parsed.data.reason ? `[REJECT] ${parsed.data.reason}` : null,
    })
    .eq("id", q.id);

  if (error) return { data: null, error: { message: error.message } };

  // If this was the only open quotation on the inquiry, mark inquiry rejected
  if (q.inquiry_id) {
    const { data: live } = await admin
      .from("quotations")
      .select("id")
      .eq("inquiry_id", q.inquiry_id)
      .in("status", ["sent", "countered"]);
    if (!live || live.length === 0) {
      await admin.from("inquiries").update({ status: "rejected" }).eq("id", q.inquiry_id);
    }
  }

  if (q.inquiry_id) revalidatePath(`/inquiries/${q.inquiry_id}`);
  revalidatePath("/inquiries");

  return { data: true, error: null };
}

// Re-export so callers needing to log to order timeline can use
export { appendOrderTimeline };
