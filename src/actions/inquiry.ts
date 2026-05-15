"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { InquiryInputSchema, type InquiryInput } from "@/lib/validations/inquiry";
import type { ActionResult } from "./auth";

export async function createInquiry(
  input: InquiryInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = InquiryInputSchema.safeParse(input);
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
    .select("role, status, full_name, email")
    .eq("id", user.id)
    .single<{ role: string; status: string; full_name: string; email: string }>();

  if (!profile || profile.status !== "active") {
    return { data: null, error: { message: "Account not active." } };
  }
  if (profile.role !== "buyer") {
    return { data: null, error: { message: "Only buyers can submit inquiries." } };
  }

  const { data, error } = await supabase
    .from("inquiries")
    .insert({
      buyer_id: user.id,
      ...parsed.data,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { data: null, error: { message: error.message } };

  // Notify seller
  try {
    const { data: seller } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", parsed.data.seller_id)
      .single<{ email: string; full_name: string }>();

    if (seller?.email) {
      await sendEmail({
        to: seller.email,
        subject: "New inquiry received — Mada Graphite",
        html: `
          <p>Hi ${seller.full_name || "Seller"},</p>
          <p><strong>${profile.full_name || profile.email}</strong> has submitted a new inquiry for <strong>${parsed.data.requested_qty} MT</strong>.</p>
          <p>Message: ${parsed.data.message ?? "—"}</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/inquiries">View inquiry</a></p>
        `,
      });
    }
  } catch (_) {
    // Email failure is non-blocking
  }

  revalidatePath("/inquiries");

  return { data: { id: data.id }, error: null };
}

/**
 * Seller "shortcut accepts" an inquiry — synthesises a default quotation
 * using the listing's posted price/currency/incoterm and qty from the
 * inquiry. Buyer must still accept the quotation before an order is
 * created (handled by `acceptQuotation`).
 *
 * For richer offers (custom price / different incoterm / specific
 * shipping window), seller should call `submitQuotation` directly via
 * the inquiry detail UI.
 */
export async function acceptInquiry(
  id: string
): Promise<ActionResult<{ inquiryId: string; quotationId: string }>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("*, listings(unit_price, currency, title, incoterm, origin_location, available_to)")
    .eq("id", id)
    .eq("seller_id", user.id)
    .single<{
      id: string;
      buyer_id: string;
      seller_id: string;
      listing_id: string | null;
      category_id: string;
      requested_qty: number;
      target_price: number | null;
      destination: string | null;
      status: string;
      listings: {
        unit_price: number;
        currency: string;
        title: string;
        incoterm: string;
        origin_location: string;
        available_to: string | null;
      } | null;
    }>();

  if (!inquiry) return { data: null, error: { message: "Inquiry not found." } };
  if (inquiry.status !== "pending" && inquiry.status !== "negotiating") {
    return { data: null, error: { message: `Inquiry is ${inquiry.status}.` } };
  }
  if (!inquiry.listing_id || !inquiry.listings) {
    return { data: null, error: { message: "Inquiry must reference a listing to send a quotation." } };
  }

  // Build a default quotation valid for 14 days
  const validity = new Date();
  validity.setDate(validity.getDate() + 14);

  // Re-use submitQuotation logic via direct insert (avoids circular import)
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  // Mark prior live quotations as superseded
  await admin
    .from("quotations")
    .update({ status: "superseded" })
    .eq("inquiry_id", id)
    .in("status", ["sent", "countered"]);

  const { data: quotation, error: qErr } = await admin
    .from("quotations")
    .insert({
      inquiry_id: id,
      seller_id: user.id,
      buyer_id: inquiry.buyer_id,
      listing_id: inquiry.listing_id,
      unit_price: inquiry.target_price ?? inquiry.listings.unit_price,
      currency: inquiry.listings.currency,
      quantity: inquiry.requested_qty,
      unit: "MT",
      incoterm: inquiry.listings.incoterm,
      origin_port: inquiry.listings.origin_location,
      destination_port: inquiry.destination,
      validity_until: validity.toISOString(),
      status: "sent",
    })
    .select("id")
    .single<{ id: string }>();

  if (qErr) return { data: null, error: { message: qErr.message } };

  await admin.from("inquiries").update({ status: "quoted" }).eq("id", id);

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
        subject: "Quotation received — Mada Graphite",
        html: `
          <p>Hi ${buyer.full_name || "Buyer"},</p>
          <p>The seller has sent a quotation for your inquiry.</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/inquiries/${id}">Review quotation</a></p>
        `,
      });
    }
  } catch (_) {}

  revalidatePath(`/inquiries/${id}`);
  revalidatePath("/inquiries");

  return { data: { inquiryId: id, quotationId: quotation.id }, error: null };
}

export async function rejectInquiry(id: string): Promise<ActionResult<true>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { error } = await supabase
    .from("inquiries")
    .update({ status: "rejected" })
    .eq("id", id)
    .eq("seller_id", user.id);

  if (error) return { data: null, error: { message: error.message } };

  revalidatePath("/inquiries");

  return { data: true, error: null };
}
