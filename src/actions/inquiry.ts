"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { InquiryInputSchema, type InquiryInput } from "@/lib/validations/inquiry";
import type { ActionResult } from "./auth";

export { InquiryInputSchema };
export type { InquiryInput } from "@/lib/validations/inquiry";

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

export async function acceptInquiry(id: string): Promise<ActionResult<{ orderId: string }>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("*, listings(unit_price, currency, title)")
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
      listings: { unit_price: number; currency: string; title: string } | null;
    }>();

  if (!inquiry) return { data: null, error: { message: "Inquiry not found." } };
  if (inquiry.status !== "pending") {
    return { data: null, error: { message: "Inquiry is no longer pending." } };
  }

  const unit_price = inquiry.target_price ?? inquiry.listings?.unit_price ?? 0;
  const total_amount = unit_price * inquiry.requested_qty;

  if (!inquiry.listing_id) {
    return { data: null, error: { message: "Inquiry must reference a listing to create an order." } };
  }

  // Create order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      buyer_id: inquiry.buyer_id,
      seller_id: user.id,
      listing_id: inquiry.listing_id,
      inquiry_id: id,
      quantity: inquiry.requested_qty,
      unit_price,
      total_amount,
      currency: inquiry.listings?.currency ?? "USDT",
      destination: inquiry.destination,
      status: "draft",
      timeline: [{ event: "order_created", at: new Date().toISOString(), by: user.id }],
    })
    .select("id")
    .single<{ id: string }>();

  if (orderError) return { data: null, error: { message: orderError.message } };

  // Update inquiry status
  await supabase
    .from("inquiries")
    .update({ status: "converted" })
    .eq("id", id);

  revalidatePath("/inquiries");
  revalidatePath("/orders");

  return { data: { orderId: order.id }, error: null };
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
