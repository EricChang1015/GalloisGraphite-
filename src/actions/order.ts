"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderContractHtml } from "@/lib/contract/template";
import { sendEmail } from "@/lib/email/resend";
import { ShipmentUpdateSchema } from "@/lib/validations/forms";
import type { ActionResult } from "./auth";
import type { Database } from "@/types/database";

type OrderStatus = Database["public"]["Enums"]["order_status"];

export { ShipmentUpdateSchema };

export const ConfirmReceiptSchema = z.object({
  order_id: z.string().uuid(),
});

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
    .update({ timeline: [...timeline, entry] as import("@/types/database").Json })
    .eq("id", orderId);
}

/** Generate the contract HTML and insert into contracts table. */
export async function generateContract(
  orderId: string
): Promise<ActionResult<{ contractId: string }>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: order } = await supabase
    .from("orders")
    .select(`
      *,
      buyer:profiles!orders_buyer_id_fkey(full_name, company_name, email, country, phone),
      seller:profiles!orders_seller_id_fkey(full_name, company_name, email, country, phone),
      listings(title, origin_location, unit, incoterm, specs,
        product_categories(name))
    `)
    .eq("id", orderId)
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
      status: OrderStatus;
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
      };
    }>();

  if (!order) return { data: null, error: { message: "Order not found." } };
  if (order.buyer_id !== user.id && order.seller_id !== user.id) {
    return { data: null, error: { message: "Access denied." } };
  }
  if (order.status !== "draft") {
    return { data: null, error: { message: "Contract already generated." } };
  }

  const contractNo = `CNT-${order.order_no}`;
  const html = renderContractHtml({
    contract: { contract_no: contractNo },
    order: {
      order_no: order.order_no,
      quantity: order.quantity,
      unit_price: order.unit_price,
      total_amount: order.total_amount,
      currency: order.currency,
      destination: order.destination,
      shipment_from: order.shipment_from,
      shipment_eta: order.shipment_eta,
      created_at: order.created_at,
    },
    listing: {
      category_name: order.listings?.product_categories?.name ?? "Graphite",
      specs: order.listings?.specs ?? {},
      origin_location: order.listings?.origin_location ?? "",
      unit: order.listings?.unit ?? "MT",
      incoterm: order.listings?.incoterm ?? "CFR",
    },
    buyer: order.buyer,
    seller: order.seller,
    platform: {
      usdt_trc20: process.env.PLATFORM_USDT_TRC20,
      usdt_erc20: process.env.PLATFORM_USDT_ERC20,
      bank_info: process.env.PLATFORM_BANK_INFO,
    },
  });

  const admin = createAdminClient();

  const { data: contract, error } = await admin
    .from("contracts")
    .insert({
      order_id: orderId,
      contract_no: contractNo,
      content_html: html,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { data: null, error: { message: error.message } };

  // Transition order status
  await appendTimeline(orderId, "contract_generated", user.id);
  await admin
    .from("orders")
    .update({ status: "contract_generated" })
    .eq("id", orderId);

  revalidatePath(`/orders/${orderId}`);

  return { data: { contractId: contract.id }, error: null };
}

export async function uploadSignedScan(
  orderId: string,
  role: "buyer" | "seller",
  fileUrl: string
): Promise<ActionResult<true>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const admin = createAdminClient();

  const column = role === "buyer" ? "buyer_signed_url" : "seller_signed_url";
  const updateData: { buyer_signed_url?: string; seller_signed_url?: string; updated_at: string } = {
    [column]: fileUrl,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin
    .from("contracts")
    .update(updateData)
    .eq("order_id", orderId);

  if (error) return { data: null, error: { message: error.message } };

  // Check if both signatures are present
  const { data: contract } = await admin
    .from("contracts")
    .select("buyer_signed_url, seller_signed_url")
    .eq("order_id", orderId)
    .single<{ buyer_signed_url: string | null; seller_signed_url: string | null }>();

  if (contract?.buyer_signed_url && contract?.seller_signed_url) {
    await admin
      .from("orders")
      .update({ status: "signed" })
      .eq("id", orderId)
      .eq("status", "contract_generated");
  }

  revalidatePath(`/orders/${orderId}`);

  return { data: true, error: null };
}

export async function updateShipment(
  input: z.infer<typeof ShipmentUpdateSchema>
): Promise<ActionResult<true>> {
  const parsed = ShipmentUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: { message: "Invalid input." } };
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const admin = createAdminClient();

  const { error } = await admin
    .from("orders")
    .update({
      status: "shipped",
      shipment_from: parsed.data.shipment_from,
      shipment_eta: parsed.data.shipment_eta,
    })
    .eq("id", parsed.data.order_id)
    .eq("seller_id", user.id)
    .eq("status", "paid");

  if (error) return { data: null, error: { message: error.message } };

  revalidatePath(`/orders/${parsed.data.order_id}`);

  return { data: true, error: null };
}

export async function markDelivered(orderId: string): Promise<ActionResult<true>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const admin = createAdminClient();

  const { error } = await admin
    .from("orders")
    .update({ status: "delivered" })
    .eq("id", orderId)
    .eq("seller_id", user.id)
    .eq("status", "shipped");

  if (error) return { data: null, error: { message: error.message } };

  revalidatePath(`/orders/${orderId}`);

  return { data: true, error: null };
}

export async function confirmReceipt(orderId: string): Promise<ActionResult<true>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const admin = createAdminClient();

  const { error } = await admin
    .from("orders")
    .update({ status: "completed" })
    .eq("id", orderId)
    .eq("buyer_id", user.id)
    .eq("status", "delivered");

  if (error) return { data: null, error: { message: error.message } };

  // Notify admin to release funds
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `Order ${orderId} — buyer confirmed receipt`,
        html: `<p>Order <strong>${orderId}</strong> marked as delivered by buyer. Please release funds to seller.</p>`,
      });
    }
  } catch (_) {}

  revalidatePath(`/orders/${orderId}`);

  return { data: true, error: null };
}
