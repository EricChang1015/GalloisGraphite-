"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderContractHtml } from "@/lib/contract/template";
import { notifyAdminEmail, notifyUser } from "@/lib/notifications/dispatch";
import { canTransition, nextAfter } from "@/lib/order/stateMachine";
import {
  ShipmentUpdateSchema,
  DraftContractSchema,
  RejectContractSchema,
  MarkArrivedSchema,
  MarkInTransitSchema,
  RaiseDisputeSchema,
  CancelOrderSchema,
} from "@/lib/validations/forms";
import type { ActionResult } from "./auth";
import type { Database, Json } from "@/types/database";

type OrderStatus = Database["public"]["Enums"]["order_status"];
type PaymentTermsType = Database["public"]["Enums"]["payment_terms_type"];

// NOTE: Next.js 16 forbids non-async-function exports from `"use server"`
// modules. Schemas live in `@/lib/validations/*`; import them directly
// from forms / components rather than re-exporting them here.

// =====================================================================
// Helpers
// =====================================================================

/** Append a timeline event to an order's timeline jsonb array. */
async function appendTimeline(
  orderId: string,
  event: string,
  actorId: string,
  meta?: Record<string, unknown>
) {
  const admin = createAdminClient();
  const entry = { event, at: new Date().toISOString(), by: actorId, ...meta };
  const { data } = await admin
    .from("orders")
    .select("timeline")
    .eq("id", orderId)
    .single<{ timeline: unknown[] }>();
  const timeline = Array.isArray(data?.timeline) ? data.timeline : [];
  await admin
    .from("orders")
    .update({ timeline: [...timeline, entry] as Json })
    .eq("id", orderId);
}

/** Transition an order's status with state-machine validation. */
async function transitionOrder(
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
  paymentTerms: PaymentTermsType | null | undefined,
  actorId: string,
  meta?: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!canTransition(from, to, paymentTerms)) {
    return { ok: false, message: `Illegal transition: ${from} ??${to}` };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ status: to })
    .eq("id", orderId)
    .eq("status", from);
  if (error) return { ok: false, message: error.message };
  await appendTimeline(orderId, to, actorId, { from, to, ...meta });
  return { ok: true };
}

type LoadResult =
  | { ok: false; error: string }
  | {
      ok: true;
      user: { id: string };
      profile: { role: string; status: string };
      order: {
        id: string;
        buyer_id: string;
        seller_id: string;
        status: OrderStatus;
        payment_terms: PaymentTermsType | null;
        payment_due_days: number | null;
        ata: string | null;
      };
      isBuyer: boolean;
      isSeller: boolean;
      isAdmin: boolean;
    };

/**
 * Look up the calling user, their role and the order. Caller can pass
 * `requireParty` to enforce buyer/seller membership (admins always pass).
 */
async function loadActorAndOrder(
  orderId: string,
  requireParty?: "buyer" | "seller" | "any"
): Promise<LoadResult> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single<{ role: string; status: string }>();

  if (!profile) return { ok: false, error: "Profile not found." };

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, buyer_id, seller_id, status, payment_terms, payment_due_days, ata"
    )
    .eq("id", orderId)
    .single<{
      id: string;
      buyer_id: string;
      seller_id: string;
      status: OrderStatus;
      payment_terms: PaymentTermsType | null;
      payment_due_days: number | null;
      ata: string | null;
    }>();

  if (!order) return { ok: false, error: "Order not found." };

  const isBuyer = order.buyer_id === user.id;
  const isSeller = order.seller_id === user.id;
  const isAdmin = profile.role === "admin" || profile.role === "super_admin";

  if (!isBuyer && !isSeller && !isAdmin) return { ok: false, error: "Access denied." };
  if (requireParty === "buyer" && !isBuyer && !isAdmin) {
    return { ok: false, error: "Only the buyer can perform this action." };
  }
  if (requireParty === "seller" && !isSeller && !isAdmin) {
    return { ok: false, error: "Only the seller can perform this action." };
  }

  return { ok: true, user, profile, order, isBuyer, isSeller, isAdmin };
}

// =====================================================================
// Contract phase
// =====================================================================

/**
 * Seller drafts (or re-drafts) the contract. Sets payment_terms +
 * payment_due_days on both order and contract; renders HTML; bumps
 * `revision_no` on re-drafts. Order moves into / stays in `contract_pending`.
 */
export async function draftContract(
  input: z.infer<typeof DraftContractSchema>
): Promise<ActionResult<{ contractId: string; revision: number }>> {
  const parsed = DraftContractSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { message: "Invalid input.", fieldErrors: z.flattenError(parsed.error).fieldErrors },
    };
  }

  const ctx = await loadActorAndOrder(parsed.data.order_id, "seller");
  if (!ctx.ok) return { data: null, error: { message: ctx.error } };

  const { user, order } = ctx;

  // Allowed in: contract_pending (re-draft), draft, quoted, negotiating
  const draftableStates: OrderStatus[] = ["draft", "quoted", "negotiating", "contract_pending"];
  if (!draftableStates.includes(order.status)) {
    return { data: null, error: { message: `Cannot draft contract from status ${order.status}.` } };
  }

  const supabase = await createServerClient();

  // Pull joined fields needed for the contract template
  const { data: full } = await supabase
    .from("orders")
    .select(`
      *,
      buyer:profiles!orders_buyer_id_fkey(full_name, company_name, email, country, phone),
      seller:profiles!orders_seller_id_fkey(full_name, company_name, email, country, phone),
      listings(title, origin_location, unit, incoterm, specs, product_categories(name))
    `)
    .eq("id", parsed.data.order_id)
    .single<{
      id: string;
      order_no: string;
      buyer_id: string;
      seller_id: string;
      quantity: number;
      unit_price: number;
      total_amount: number;
      currency: string;
      destination: string | null;
      shipment_from: string | null;
      shipment_eta: string | null;
      created_at: string;
      buyer: { full_name: string; company_name: string; email: string; country: string; phone: string };
      seller: { full_name: string; company_name: string; email: string; country: string; phone: string };
      listings: {
        title: string;
        origin_location: string;
        unit: string;
        incoterm: string;
        specs: Record<string, unknown>;
        product_categories: { name: string } | null;
      } | null;
    }>();
  if (!full) return { data: null, error: { message: "Order detail missing." } };

  const admin = createAdminClient();

  // Determine revision number: if a contract row already exists, increment
  const { data: existing } = await admin
    .from("contracts")
    .select("id, revision_no")
    .eq("order_id", full.id)
    .maybeSingle<{ id: string; revision_no: number }>();

  const revision = (existing?.revision_no ?? 0) + 1;
  const contractNo = `CNT-${full.order_no}-R${revision}`;

  const html = renderContractHtml({
    contract: { contract_no: contractNo },
    order: {
      order_no: full.order_no,
      quantity: full.quantity,
      unit_price: full.unit_price,
      total_amount: full.total_amount,
      currency: full.currency,
      destination: full.destination,
      shipment_from: full.shipment_from,
      shipment_eta: full.shipment_eta,
      created_at: full.created_at,
    },
    listing: {
      category_name: full.listings?.product_categories?.name ?? "Graphite",
      specs: full.listings?.specs ?? {},
      origin_location: full.listings?.origin_location ?? "",
      unit: full.listings?.unit ?? "MT",
      incoterm: full.listings?.incoterm ?? "CFR",
    },
    buyer: full.buyer,
    seller: full.seller,
    platform: {
      usdt_trc20: process.env.PLATFORM_USDT_TRC20,
      usdt_erc20: process.env.PLATFORM_USDT_ERC20,
      bank_info: process.env.PLATFORM_BANK_INFO,
    },
  });

  let contractId: string;
  if (existing) {
    const { error } = await admin
      .from("contracts")
      .update({
        contract_no: contractNo,
        content_html: html,
        revision_no: revision,
        payment_terms: parsed.data.payment_terms,
        payment_due_days: parsed.data.payment_due_days,
        // Reset signature & approval state for the new revision
        buyer_signed_url: null,
        seller_signed_url: null,
        buyer_signed_at: null,
        seller_signed_at: null,
        buyer_approved_at: null,
        buyer_rejected_at: null,
        buyer_reject_reason: null,
      })
      .eq("id", existing.id);
    if (error) return { data: null, error: { message: error.message } };
    contractId = existing.id;
  } else {
    const { data: created, error } = await admin
      .from("contracts")
      .insert({
        order_id: full.id,
        contract_no: contractNo,
        content_html: html,
        revision_no: revision,
        payment_terms: parsed.data.payment_terms,
        payment_due_days: parsed.data.payment_due_days,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !created) return { data: null, error: { message: error?.message ?? "Insert failed." } };
    contractId = created.id;
  }

  // Snapshot payment terms onto the order so downstream actions can branch
  await admin
    .from("orders")
    .update({
      payment_terms: parsed.data.payment_terms,
      payment_due_days: parsed.data.payment_due_days,
    })
    .eq("id", full.id);

  // Move into contract_pending if not already
  if (order.status !== "contract_pending") {
    await transitionOrder(
      full.id,
      order.status,
      "contract_pending",
      parsed.data.payment_terms,
      user.id,
      { revision }
    );
  } else {
    await appendTimeline(full.id, "contract_redrafted", user.id, { revision });
  }

  // Notify buyer to review
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await notifyUser({
      email: full.buyer.email,
      phone: full.buyer.phone,
      subject: `Contract ready for review — ${full.order_no}`,
      html: `
        <p>Hi ${full.buyer.full_name || "Buyer"},</p>
        <p>The seller has drafted contract <strong>${contractNo}</strong> (revision ${revision}).
           Please review and approve, or send it back with comments.</p>
        <p><a href="${appUrl}/orders/${full.id}">Open order</a></p>
      `,
      smsText: `Mada Graphite: Contract ${full.order_no} ready for review. ${appUrl}/orders/${full.id}`,
    });
  } catch (_) {}

  revalidatePath(`/orders/${full.id}`);

  return { data: { contractId, revision }, error: null };
}

/** Buyer agrees with the contract content. UI then unlocks signature uploads. */
export async function approveContract(orderId: string): Promise<ActionResult<true>> {
  const ctx = await loadActorAndOrder(orderId, "buyer");
  if (!ctx.ok) return { data: null, error: { message: ctx.error } };

  if (ctx.order.status !== "contract_pending") {
    return { data: null, error: { message: "Contract is not in review." } };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("contracts")
    .update({
      buyer_approved_at: new Date().toISOString(),
      buyer_rejected_at: null,
      buyer_reject_reason: null,
    })
    .eq("order_id", orderId);

  if (error) return { data: null, error: { message: error.message } };

  await appendTimeline(orderId, "contract_approved_by_buyer", ctx.user.id);

  revalidatePath(`/orders/${orderId}`);
  return { data: true, error: null };
}

/** Buyer rejects the contract; seller can re-draft (revision++). */
export async function rejectContract(
  input: z.infer<typeof RejectContractSchema>
): Promise<ActionResult<true>> {
  const parsed = RejectContractSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  const ctx = await loadActorAndOrder(parsed.data.order_id, "buyer");
  if (!ctx.ok) return { data: null, error: { message: ctx.error } };

  if (ctx.order.status !== "contract_pending") {
    return { data: null, error: { message: "Contract is not in review." } };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("contracts")
    .update({
      buyer_rejected_at: new Date().toISOString(),
      buyer_reject_reason: parsed.data.reason,
      buyer_approved_at: null,
    })
    .eq("order_id", parsed.data.order_id);

  if (error) return { data: null, error: { message: error.message } };

  await appendTimeline(parsed.data.order_id, "contract_rejected_by_buyer", ctx.user.id, {
    reason: parsed.data.reason,
  });

  // Notify seller
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { data: seller } = await admin
      .from("profiles")
      .select("email, full_name, phone")
      .eq("id", ctx.order.seller_id)
      .single<{ email: string; full_name: string; phone: string | null }>();
    await notifyUser({
      email: seller?.email,
      phone: seller?.phone,
      subject: `Contract returned for revision — Order ${parsed.data.order_id.slice(0, 8)}`,
      html: `
          <p>Hi ${seller?.full_name || "Seller"},</p>
          <p>The buyer has returned the contract with the following note:</p>
          <blockquote>${parsed.data.reason}</blockquote>
          <p><a href="${appUrl}/orders/${parsed.data.order_id}">Re-draft contract</a></p>
        `,
      smsText: `Mada Graphite: Contract returned. Re-draft: ${appUrl}/orders/${parsed.data.order_id}`,
    });
  } catch (_) {}

  revalidatePath(`/orders/${parsed.data.order_id}`);
  return { data: true, error: null };
}

/**
 * Both parties upload their signed scans; once both present (and buyer
 * has approved), order auto-advances to `contract_signed` then onto the
 * payment-terms-specific next state.
 */
export async function uploadSignedScan(
  orderId: string,
  role: "buyer" | "seller",
  fileUrl: string
): Promise<ActionResult<true>> {
  const ctx = await loadActorAndOrder(orderId, role === "buyer" ? "buyer" : "seller");
  if (!ctx.ok) return { data: null, error: { message: ctx.error } };
  if (ctx.order.status !== "contract_pending" && ctx.order.status !== "contract_signed") {
    return { data: null, error: { message: `Cannot upload signature in ${ctx.order.status}.` } };
  }

  const admin = createAdminClient();

  const now = new Date().toISOString();
  const update =
    role === "buyer"
      ? { buyer_signed_url: fileUrl, buyer_signed_at: now, updated_at: now }
      : { seller_signed_url: fileUrl, seller_signed_at: now, updated_at: now };

  const { error } = await admin.from("contracts").update(update).eq("order_id", orderId);
  if (error) return { data: null, error: { message: error.message } };

  // Also write a document row for the signed scan
  await admin.from("order_documents").insert({
    order_id: orderId,
    type: role === "buyer" ? "contract_signed_buyer" : "contract_signed_seller",
    file_url: fileUrl,
    uploaded_by: ctx.user.id,
  });

  // Check whether both scans are present + buyer has approved
  const { data: contract } = await admin
    .from("contracts")
    .select("buyer_signed_url, seller_signed_url, buyer_approved_at")
    .eq("order_id", orderId)
    .single<{
      buyer_signed_url: string | null;
      seller_signed_url: string | null;
      buyer_approved_at: string | null;
    }>();

  if (
    contract?.buyer_signed_url &&
    contract?.seller_signed_url &&
    contract?.buyer_approved_at &&
    ctx.order.status === "contract_pending"
  ) {
    // Move to contract_signed, then auto-step to next branch state
    await transitionOrder(
      orderId,
      "contract_pending",
      "contract_signed",
      ctx.order.payment_terms,
      ctx.user.id
    );
    const next = nextAfter("contract_signed", ctx.order.payment_terms);
    if (next) {
      await transitionOrder(
        orderId,
        "contract_signed",
        next,
        ctx.order.payment_terms,
        ctx.user.id
      );
    }
  }

  await appendTimeline(orderId, `signed_scan_uploaded_${role}`, ctx.user.id);

  revalidatePath(`/orders/${orderId}`);
  return { data: true, error: null };
}

// =====================================================================
// Production / Shipping phase
// =====================================================================

export async function markInProduction(orderId: string): Promise<ActionResult<true>> {
  const ctx = await loadActorAndOrder(orderId, "seller");
  if (!ctx.ok) return { data: null, error: { message: ctx.error } };

  // Allowed sources differ by payment_terms (full_prepay needs paid first)
  const result = await transitionOrder(
    orderId,
    ctx.order.status,
    "in_production",
    ctx.order.payment_terms,
    ctx.user.id
  );
  if (!result.ok) return { data: null, error: { message: result.message } };

  revalidatePath(`/orders/${orderId}`);
  return { data: true, error: null };
}

export async function markReadyToShip(orderId: string): Promise<ActionResult<true>> {
  const ctx = await loadActorAndOrder(orderId, "seller");
  if (!ctx.ok) return { data: null, error: { message: ctx.error } };

  const result = await transitionOrder(
    orderId,
    ctx.order.status,
    "ready_to_ship",
    ctx.order.payment_terms,
    ctx.user.id
  );
  if (!result.ok) return { data: null, error: { message: result.message } };

  revalidatePath(`/orders/${orderId}`);
  return { data: true, error: null };
}

/**
 * Seller marks shipment, capturing B/L + vessel + container + ETD/ATD/ETA
 * details. Order ??`shipped`.
 */
export async function markShipped(
  input: z.infer<typeof ShipmentUpdateSchema>
): Promise<ActionResult<true>> {
  const parsed = ShipmentUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { message: "Invalid input.", fieldErrors: z.flattenError(parsed.error).fieldErrors },
    };
  }

  const ctx = await loadActorAndOrder(parsed.data.order_id, "seller");
  if (!ctx.ok) return { data: null, error: { message: ctx.error } };

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({
      shipment_from: parsed.data.shipment_from,
      shipment_eta: parsed.data.shipment_eta,
      bl_no: parsed.data.bl_no ?? null,
      bl_date: parsed.data.bl_date ?? null,
      vessel_name: parsed.data.vessel_name ?? null,
      vessel_imo: parsed.data.vessel_imo ?? null,
      container_numbers: parsed.data.container_numbers ?? null,
      etd: parsed.data.etd ?? null,
      atd: parsed.data.atd ?? null,
    })
    .eq("id", parsed.data.order_id);
  if (error) return { data: null, error: { message: error.message } };

  const result = await transitionOrder(
    parsed.data.order_id,
    ctx.order.status,
    "shipped",
    ctx.order.payment_terms,
    ctx.user.id,
    { bl_no: parsed.data.bl_no, vessel_name: parsed.data.vessel_name }
  );
  if (!result.ok) return { data: null, error: { message: result.message } };

  // Notify buyer
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { data: buyer } = await admin
      .from("profiles")
      .select("email, full_name, phone")
      .eq("id", ctx.order.buyer_id)
      .single<{ email: string; full_name: string; phone: string | null }>();
    await notifyUser({
      email: buyer?.email,
      phone: buyer?.phone,
      subject: `Shipment dispatched — Order ${parsed.data.order_id.slice(0, 8)}`,
      html: `
          <p>Hi ${buyer?.full_name || "Buyer"},</p>
          <p>Your order has been shipped${parsed.data.vessel_name ? ` on <strong>${parsed.data.vessel_name}</strong>` : ""}.</p>
          ${parsed.data.bl_no ? `<p>B/L No: <strong>${parsed.data.bl_no}</strong></p>` : ""}
          ${parsed.data.shipment_eta ? `<p>ETA: ${parsed.data.shipment_eta}</p>` : ""}
          <p><a href="${appUrl}/orders/${parsed.data.order_id}">Track shipment</a></p>
        `,
      smsText: `Mada Graphite: Order shipped. Track: ${appUrl}/orders/${parsed.data.order_id}`,
    });
  } catch (_) {}

  revalidatePath(`/orders/${parsed.data.order_id}`);
  return { data: true, error: null };
}

export async function markInTransit(
  input: z.infer<typeof MarkInTransitSchema>
): Promise<ActionResult<true>> {
  const parsed = MarkInTransitSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  const ctx = await loadActorAndOrder(parsed.data.order_id, "seller");
  if (!ctx.ok) return { data: null, error: { message: ctx.error } };

  const result = await transitionOrder(
    parsed.data.order_id,
    ctx.order.status,
    "in_transit",
    ctx.order.payment_terms,
    ctx.user.id,
    { note: parsed.data.note }
  );
  if (!result.ok) return { data: null, error: { message: result.message } };

  revalidatePath(`/orders/${parsed.data.order_id}`);
  return { data: true, error: null };
}

/**
 * Vessel arrived at destination port. Computes `payment_due_date` based on
 * payment_terms + payment_due_days for net_after_arrival flow.
 */
export async function markArrived(
  input: z.infer<typeof MarkArrivedSchema>
): Promise<ActionResult<true>> {
  const parsed = MarkArrivedSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  const ctx = await loadActorAndOrder(parsed.data.order_id, "any");
  if (!ctx.ok) return { data: null, error: { message: ctx.error } };

  const admin = createAdminClient();

  // Compute payment_due_date for net_after_arrival
  const ata = new Date(parsed.data.ata);
  let due: string | null = null;
  if (
    ctx.order.payment_terms === "net_after_arrival" &&
    typeof ctx.order.payment_due_days === "number"
  ) {
    const d = new Date(ata);
    d.setDate(d.getDate() + ctx.order.payment_due_days);
    due = d.toISOString().slice(0, 10);
  }

  const { error: updErr } = await admin
    .from("orders")
    .update({
      ata: parsed.data.ata,
      payment_due_date: due,
    })
    .eq("id", parsed.data.order_id);
  if (updErr) return { data: null, error: { message: updErr.message } };

  const result = await transitionOrder(
    parsed.data.order_id,
    ctx.order.status,
    "arrived",
    ctx.order.payment_terms,
    ctx.user.id,
    { ata: parsed.data.ata, payment_due_date: due, note: parsed.data.note }
  );
  if (!result.ok) return { data: null, error: { message: result.message } };

  revalidatePath(`/orders/${parsed.data.order_id}`);
  return { data: true, error: null };
}

/**
 * Buyer confirms customs cleared. For `full_prepay`, auto-completes the
 * order. For `net_after_arrival`, moves to `payment_pending` and notifies
 * admin to expect buyer's payment.
 */
export async function markCustomsCleared(orderId: string): Promise<ActionResult<true>> {
  const ctx = await loadActorAndOrder(orderId, "buyer");
  if (!ctx.ok) return { data: null, error: { message: ctx.error } };

  const admin = createAdminClient();
  await admin
    .from("orders")
    .update({ customs_cleared_at: new Date().toISOString() })
    .eq("id", orderId);

  const result = await transitionOrder(
    orderId,
    ctx.order.status,
    "customs_cleared",
    ctx.order.payment_terms,
    ctx.user.id
  );
  if (!result.ok) return { data: null, error: { message: result.message } };

  // Auto-step downstream
  const next = nextAfter("customs_cleared", ctx.order.payment_terms);
  if (next) {
    await transitionOrder(
      orderId,
      "customs_cleared",
      next,
      ctx.order.payment_terms,
      ctx.user.id
    );

    if (next === "completed") {
      // Notify admin for record-keeping (buyer already prepaid)
      try {
        await notifyAdminEmail({
          subject: `Order ${orderId.slice(0, 8)} completed — buyer cleared customs`,
          html: `<p>Order <strong>${orderId}</strong> auto-completed (full prepayment, customs cleared).</p>`,
        });
      } catch (_) {}
    } else if (next === "payment_pending") {
      // Notify buyer that final payment is due
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const { data: buyer } = await admin
          .from("profiles")
          .select("email, full_name, phone")
          .eq("id", ctx.order.buyer_id)
          .single<{ email: string; full_name: string; phone: string | null }>();
        await notifyUser({
          email: buyer?.email,
          phone: buyer?.phone,
          subject: `Final payment due — Order ${orderId.slice(0, 8)}`,
          html: `
              <p>Hi ${buyer?.full_name || "Buyer"},</p>
              <p>Customs cleared. Please submit final payment per the agreed terms.</p>
              <p><a href="${appUrl}/orders/${orderId}">Submit payment</a></p>
            `,
          smsText: `Mada Graphite: Final payment due. ${appUrl}/orders/${orderId}`,
        });
      } catch (_) {}
    }
  }

  revalidatePath(`/orders/${orderId}`);
  return { data: true, error: null };
}

// =====================================================================
// Dispute / Cancel
// =====================================================================

export async function raiseDispute(
  input: z.infer<typeof RaiseDisputeSchema>
): Promise<ActionResult<true>> {
  const parsed = RaiseDisputeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { message: "Invalid input.", fieldErrors: z.flattenError(parsed.error).fieldErrors },
    };
  }

  const ctx = await loadActorAndOrder(parsed.data.order_id, "any");
  if (!ctx.ok) return { data: null, error: { message: ctx.error } };

  if (ctx.order.status === "completed" || ctx.order.status === "cancelled") {
    return { data: null, error: { message: "Order is closed." } };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ status: "disputed" })
    .eq("id", parsed.data.order_id);
  if (error) return { data: null, error: { message: error.message } };

  await appendTimeline(parsed.data.order_id, "disputed", ctx.user.id, {
    from: ctx.order.status,
    to: "disputed",
    reason: parsed.data.reason,
  });

  await admin.from("audit_logs").insert({
    actor_id: ctx.user.id,
    action: "raise_dispute",
    target_type: "order",
    target_id: parsed.data.order_id,
    metadata: { reason: parsed.data.reason, from: ctx.order.status } as Json,
  });

  // Notify admin
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await notifyAdminEmail({
      subject: `Dispute raised — Order ${parsed.data.order_id.slice(0, 8)}`,
      html: `
          <p>Order <strong>${parsed.data.order_id}</strong> marked as disputed.</p>
          <p>Reason: ${parsed.data.reason}</p>
          <p><a href="${appUrl}/admin/orders">Review</a></p>
        `,
    });
  } catch (_) {}

  revalidatePath(`/orders/${parsed.data.order_id}`);
  return { data: true, error: null };
}

export async function cancelOrder(
  input: z.infer<typeof CancelOrderSchema>
): Promise<ActionResult<true>> {
  const parsed = CancelOrderSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  const ctx = await loadActorAndOrder(parsed.data.order_id, "any");
  if (!ctx.ok) return { data: null, error: { message: ctx.error } };

  // Cancellable only in pre-shipment states
  const cancellable: OrderStatus[] = [
    "draft",
    "quotation_pending",
    "quoted",
    "negotiating",
    "contract_pending",
    "contract_signed",
    "payment_pending",
    "in_production",
    "ready_to_ship",
    "disputed",
  ];
  if (!cancellable.includes(ctx.order.status)) {
    return { data: null, error: { message: `Cannot cancel from status ${ctx.order.status}.` } };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.order_id);
  if (error) return { data: null, error: { message: error.message } };

  await appendTimeline(parsed.data.order_id, "cancelled", ctx.user.id, {
    from: ctx.order.status,
    to: "cancelled",
    reason: parsed.data.reason,
  });

  await admin.from("audit_logs").insert({
    actor_id: ctx.user.id,
    action: "cancel_order",
    target_type: "order",
    target_id: parsed.data.order_id,
    metadata: { reason: parsed.data.reason, from: ctx.order.status } as Json,
  });

  revalidatePath(`/orders/${parsed.data.order_id}`);
  return { data: true, error: null };
}

// =====================================================================
// Admin-only
// =====================================================================

/**
 * Force-transition an order to any state, bypassing the state machine.
 * Reserved for admin recovery / mediation flows. Always logs to audit_logs.
 */
export async function forceTransitionOrder(
  orderId: string,
  toStatus: OrderStatus,
  reason: string
): Promise<ActionResult<true>> {
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
  const { data: cur } = await admin
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single<{ status: OrderStatus }>();
  if (!cur) return { data: null, error: { message: "Order not found." } };

  const { error } = await admin
    .from("orders")
    .update({ status: toStatus })
    .eq("id", orderId);
  if (error) return { data: null, error: { message: error.message } };

  await appendTimeline(orderId, `force_transition`, user.id, {
    from: cur.status,
    to: toStatus,
    reason,
  });

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "force_transition_order",
    target_type: "order",
    target_id: orderId,
    metadata: { from: cur.status, to: toStatus, reason } as Json,
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/admin/orders/${orderId}`);
  return { data: true, error: null };
}

// =====================================================================
// Backwards-compat wrappers (used by existing UI until migrated)
// =====================================================================

/**
 * Legacy buyer-facing "confirm receipt" ??equivalent to markCustomsCleared.
 * Retained so existing OrderActions.tsx continues to compile during the
 * UI migration window.
 */
export async function confirmReceipt(orderId: string): Promise<ActionResult<true>> {
  return markCustomsCleared(orderId);
}

/**
 * Legacy seller-facing "update shipment" ??alias for markShipped.
 */
export async function updateShipment(
  input: z.infer<typeof ShipmentUpdateSchema>
): Promise<ActionResult<true>> {
  return markShipped(input);
}

/**
 * Legacy seller-facing "mark delivered" ??equivalent to markArrived (with
 * today's date) followed by markCustomsCleared in the seller view. Kept as
 * a no-op alias for compatibility; new UI should call markArrived directly.
 */
export async function markDelivered(orderId: string): Promise<ActionResult<true>> {
  return markArrived({
    order_id: orderId,
    ata: new Date().toISOString().slice(0, 10),
  });
}

/**
 * Legacy "generate contract" ??defaults to full_prepay / 5 days. New UI
 * should call draftContract with explicit terms.
 */
export async function generateContract(
  orderId: string
): Promise<ActionResult<{ contractId: string }>> {
  const result = await draftContract({
    order_id: orderId,
    payment_terms: "full_prepay",
    payment_due_days: 5,
  });
  if (result.error) return { data: null, error: result.error };
  return { data: { contractId: result.data!.contractId }, error: null };
}
