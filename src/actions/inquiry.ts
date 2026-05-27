"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications/dispatch";
import {
  describeCommercialGap,
  findCommercialProfileGaps,
} from "@/lib/auth/commercial";
import { checkKycGate } from "@/lib/kyc/gate";
import { describeKycGateFailure } from "@/lib/kyc/messages";
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

  const missing = await findCommercialProfileGaps(user.id);
  if (missing.length > 0) {
    return {
      data: null,
      error: {
        message: describeCommercialGap(missing),
        code: "PROFILE_INCOMPLETE",
        fields: missing,
      },
    };
  }

  const kycGate = await checkKycGate(user.id, "submit_inquiry");
  if (!kycGate.ok) {
    return {
      data: null,
      error: {
        message: describeKycGateFailure(
          kycGate.requiredLevel,
          kycGate.currentLevel,
          kycGate.action
        ),
        code: "KYC_REQUIRED",
        requiredLevel: kycGate.requiredLevel,
        currentLevel: kycGate.currentLevel,
      },
    };
  }

  // MOQ guard — when the listing declares a minimum order quantity,
  // reject requests below the floor with a friendly explanation. Buyers
  // can still negotiate via quotation, but the initial inquiry must
  // respect the seller's published MOQ.
  if (parsed.data.listing_id) {
    const { data: listingRow } = await supabase
      .from("listings")
      .select("min_order_quantity, unit, status, seller_id")
      .eq("id", parsed.data.listing_id)
      .single<{
        min_order_quantity: number | null;
        unit: string;
        status: string;
        seller_id: string;
      }>();
    if (listingRow) {
      if (listingRow.status !== "active") {
        return {
          data: null,
          error: {
            message:
              "This listing is no longer accepting inquiries.",
            code: "LISTING_INACTIVE",
          },
        };
      }
      if (listingRow.seller_id !== parsed.data.seller_id) {
        return {
          data: null,
          error: {
            message: "Inquiry seller does not match the listing's seller.",
            code: "SELLER_MISMATCH",
          },
        };
      }
      if (
        listingRow.min_order_quantity != null &&
        parsed.data.requested_qty < listingRow.min_order_quantity
      ) {
        return {
          data: null,
          error: {
            message: `Minimum order is ${listingRow.min_order_quantity.toLocaleString()} ${listingRow.unit} for this listing.`,
            code: "BELOW_MOQ",
            fieldErrors: {
              requested_qty: [
                `Must be at least ${listingRow.min_order_quantity.toLocaleString()} ${listingRow.unit}.`,
              ],
            },
          },
        };
      }
    }
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { data: seller } = await supabase
      .from("profiles")
      .select("email, full_name, phone")
      .eq("id", parsed.data.seller_id)
      .single<{ email: string; full_name: string; phone: string | null }>();

    await notifyUser({
      email: seller?.email,
      phone: seller?.phone,
      subject: "New inquiry received — Mada Graphite",
      html: `
          <p>Hi ${seller?.full_name || "Seller"},</p>
          <p><strong>${profile.full_name || profile.email}</strong> has submitted a new inquiry for <strong>${parsed.data.requested_qty} MT</strong>.</p>
          <p>Message: ${parsed.data.message ?? "—"}</p>
          <p><a href="${appUrl}/inquiries">View inquiry</a></p>
        `,
      smsText: `Mada Graphite: New inquiry for ${parsed.data.requested_qty} MT. ${appUrl}/inquiries`,
    });
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
 * STRICTLY for the initial `pending` state (no quotation yet). Once a
 * quotation exists (status=`quoted`/`negotiating`), the seller MUST act
 * on the live quotation through the inquiry detail page's
 * `<QuotationActions />` (Accept / Counter / Decline) — otherwise this
 * shortcut would silently mark the buyer's live counter-offer as
 * `superseded` and replace it with a default seller offer, erasing the
 * negotiation history.
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
  if (inquiry.status !== "pending") {
    return {
      data: null,
      error: {
        message:
          "A quotation already exists on this inquiry. Open the inquiry to Accept / Counter / Decline the live offer instead of sending a default.",
        code: "QUOTATION_ALREADY_EXISTS",
      },
    };
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
      created_by: user.id,
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { data: buyer } = await admin
      .from("profiles")
      .select("email, full_name, phone")
      .eq("id", inquiry.buyer_id)
      .single<{ email: string; full_name: string; phone: string | null }>();
    await notifyUser({
      email: buyer?.email,
      phone: buyer?.phone,
      subject: "Quotation received — Mada Graphite",
      html: `
          <p>Hi ${buyer?.full_name || "Buyer"},</p>
          <p>The seller has sent a quotation for your inquiry.</p>
          <p><a href="${appUrl}/inquiries/${id}">Review quotation</a></p>
        `,
      smsText: `Mada Graphite: Quotation received. Review: ${appUrl}/inquiries/${id}`,
    });
  } catch (_) {}

  revalidatePath(`/inquiries/${id}`);
  revalidatePath("/inquiries");

  return { data: { inquiryId: id, quotationId: quotation.id }, error: null };
}

/**
 * Seller declines an inquiry. Allowed when:
 *   - `status='pending'` (no quotation yet) — seller walks away outright.
 *   - `status='quoted'/'negotiating'` AND the live quotation is NOT one
 *     the seller proposed (i.e. it's the buyer's counter that the seller
 *     could otherwise Accept / Counter; declining the inquiry as a whole
 *     is the third valid response).
 *
 * Refuses to act when the seller is the proposer of the live quotation —
 * declining "your own offer" makes no sense; the seller can simply send
 * a counter or let the quotation expire.
 *
 * On success the live quotation (if any) is also marked `rejected`, so
 * the historical view stays consistent and `acceptQuotation` cannot be
 * raced against this call.
 */
export async function rejectInquiry(id: string): Promise<ActionResult<true>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("id, seller_id, status")
    .eq("id", id)
    .eq("seller_id", user.id)
    .single<{ id: string; seller_id: string; status: string }>();
  if (!inquiry) return { data: null, error: { message: "Inquiry not found." } };
  if (
    inquiry.status === "rejected" ||
    inquiry.status === "converted" ||
    inquiry.status === "expired"
  ) {
    return { data: null, error: { message: `Inquiry is ${inquiry.status}.` } };
  }

  const { data: live } = await supabase
    .from("quotations")
    .select("id, created_by")
    .eq("inquiry_id", id)
    .eq("status", "sent")
    .maybeSingle<{ id: string; created_by: string }>();

  if (live && live.created_by === user.id) {
    return {
      data: null,
      error: {
        message:
          "You cannot decline an inquiry while your own counter-offer is live. Wait for the buyer to respond, or let the quotation expire.",
        code: "OWN_LIVE_OFFER",
      },
    };
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  if (live) {
    await admin
      .from("quotations")
      .update({
        status: "rejected",
        countered_by: user.id,
        responded_at: new Date().toISOString(),
      })
      .eq("id", live.id);
  }

  const { error } = await admin
    .from("inquiries")
    .update({ status: "rejected" })
    .eq("id", id);
  if (error) return { data: null, error: { message: error.message } };

  revalidatePath(`/inquiries/${id}`);
  revalidatePath("/inquiries");

  return { data: true, error: null };
}
