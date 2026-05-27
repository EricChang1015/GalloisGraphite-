import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { createServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QuotationForm } from "@/components/listing/QuotationForm";
import { QuotationActions } from "@/components/listing/QuotationActions";

interface PageProps {
  params: Promise<{ id: string }>;
}

const inquiryStatusColor: Record<string, string> = {
  pending: "text-yellow-400 border-yellow-400/40",
  quoted: "text-blue-400 border-blue-400/40",
  negotiating: "text-purple-400 border-purple-400/40",
  accepted: "text-cyan-400 border-cyan-400/40",
  converted: "text-emerald-400 border-emerald-400/40",
  rejected: "text-red-400 border-red-400/40",
  expired: "text-muted-foreground border-border",
};

const quotationStatusColor: Record<string, string> = {
  sent: "text-blue-400 border-blue-400/40",
  countered: "text-purple-400 border-purple-400/40",
  accepted: "text-emerald-400 border-emerald-400/40",
  rejected: "text-red-400 border-red-400/40",
  expired: "text-muted-foreground border-border",
  superseded: "text-muted-foreground border-border",
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations("inquiries");
  return {
    title: t("metaTitleDetail", { code: id.slice(0, 8).toUpperCase() }),
  };
}

export default async function InquiryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  const { data: inquiry } = await supabase
    .from("inquiries")
    .select(`
      *,
      buyer:profiles!inquiries_buyer_id_fkey(full_name, company_name, email, country),
      seller:profiles!inquiries_seller_id_fkey(full_name, company_name, email, country),
      product_categories(name),
      listings(title, unit_price, currency, incoterm, origin_location)
    `)
    .eq("id", id)
    .single<{
      id: string;
      buyer_id: string;
      seller_id: string;
      listing_id: string | null;
      requested_qty: number;
      target_price: number | null;
      destination: string | null;
      message: string | null;
      status: string;
      created_at: string;
      buyer: { full_name: string; company_name: string; email: string; country: string } | null;
      seller: { full_name: string; company_name: string; email: string; country: string } | null;
      product_categories: { name: string } | null;
      listings: {
        title: string;
        unit_price: number;
        currency: string;
        incoterm: string;
        origin_location: string;
      } | null;
    }>();

  if (!inquiry) notFound();

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const isBuyer = inquiry.buyer_id === user.id;
  const isSeller = inquiry.seller_id === user.id;
  if (!isBuyer && !isSeller && !isAdmin) notFound();

  const t = await getTranslations("inquiries.detail");
  const tFields = await getTranslations("inquiries.detail.fields");
  const tHistory = await getTranslations("inquiries.detail.history");
  const tHistoryFields = await getTranslations("inquiries.detail.history.fields");
  const tRolePlain = await getTranslations("inquiries.detail.history.rolePlain");
  const tEnums = await getTranslations("enums");

  function translateInquiryStatus(status: string): string {
    const known = [
      "pending",
      "quoted",
      "negotiating",
      "accepted",
      "rejected",
      "expired",
      "converted",
    ] as const;
    return (known as readonly string[]).includes(status)
      ? tEnums(`inquiry.status.${status}`)
      : status;
  }

  function translateQuotationStatus(status: string): string {
    const known = [
      "pending",
      "accepted",
      "rejected",
      "countered",
      "superseded",
      "expired",
    ] as const;
    if ((known as readonly string[]).includes(status)) {
      return tEnums(`quotation.status.${status}`);
    }
    // Legacy DB value "sent" still surfaces as "pending" in the UI semantics.
    if (status === "sent") return tEnums("quotation.status.pending");
    return status;
  }

  // Quotations history (newest first)
  const { data: quotations } = await supabase
    .from("quotations")
    .select(
      "id, parent_quotation_id, seller_id, buyer_id, created_by, unit_price, currency, quantity, unit, incoterm, origin_port, destination_port, validity_until, notes, status, created_at, responded_at, countered_by"
    )
    .eq("inquiry_id", id)
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        parent_quotation_id: string | null;
        seller_id: string;
        buyer_id: string;
        created_by: string;
        unit_price: number;
        currency: string;
        quantity: number;
        unit: string;
        incoterm: string;
        origin_port: string | null;
        destination_port: string | null;
        validity_until: string;
        notes: string | null;
        status: string;
        created_at: string;
        responded_at: string | null;
        countered_by: string | null;
      }[]
    >();

  const liveQuotation = quotations?.find((q) => q.status === "sent");

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            <Link href="/inquiries" className="hover:text-foreground">
              {t("breadcrumb")}
            </Link>{" "}
            / {id.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="text-2xl font-semibold">
            {inquiry.product_categories?.name ?? t("fallbackTitle")}
          </h1>
        </div>
        <Badge variant="outline" className={inquiryStatusColor[inquiry.status] ?? ""}>
          {translateInquiryStatus(inquiry.status)}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4 space-y-1 text-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {t("buyer")}
          </p>
          <p className="font-medium">{inquiry.buyer?.company_name ?? t("noValue")}</p>
          <p className="text-muted-foreground">
            {inquiry.buyer?.full_name} · {inquiry.buyer?.country}
          </p>
        </div>
        <div className="rounded-lg border p-4 space-y-1 text-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {t("seller")}
          </p>
          <p className="font-medium">{inquiry.seller?.company_name ?? t("noValue")}</p>
          <p className="text-muted-foreground">
            {inquiry.seller?.full_name} · {inquiry.seller?.country}
          </p>
        </div>
      </div>

      <div className="rounded-lg border divide-y text-sm">
        {[
          [tFields("listing"), inquiry.listings?.title ?? t("noValue")],
          [
            tFields("requestedQty"),
            t("qtyValue", { value: inquiry.requested_qty }),
          ],
          [
            tFields("targetPrice"),
            inquiry.target_price
              ? `${inquiry.target_price} ${inquiry.listings?.currency ?? ""}`
              : t("noValue"),
          ],
          [tFields("destination"), inquiry.destination ?? t("noValue")],
          [tFields("origin"), inquiry.listings?.origin_location ?? t("noValue")],
          [tFields("listingIncoterm"), inquiry.listings?.incoterm ?? t("noValue")],
          [tFields("buyerMessage"), inquiry.message ?? t("noValue")],
          [tFields("created"), new Date(inquiry.created_at).toLocaleString()],
        ].map(([label, value]) => (
          <div key={label} className="flex items-start px-4 py-2">
            <span className="w-36 text-muted-foreground shrink-0">{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>

      {/* Quotation history */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{tHistory("heading")}</h2>
          {isSeller && !liveQuotation && inquiry.status !== "converted" && inquiry.status !== "rejected" && (
            <Dialog>
              <DialogTrigger render={<Button size="sm" />}>
                {tHistory("sendButton")}
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{tHistory("dialogTitle")}</DialogTitle>
                </DialogHeader>
                <QuotationForm
                  inquiryId={id}
                  defaults={{
                    quantity: inquiry.requested_qty,
                    unit_price: inquiry.target_price ?? inquiry.listings?.unit_price ?? 0,
                    currency: inquiry.listings?.currency ?? "USDT",
                    incoterm: (inquiry.listings?.incoterm as "FOB" | "CFR" | "CIF" | undefined) ?? "CFR",
                    origin_port: inquiry.listings?.origin_location ?? "",
                    destination_port: inquiry.destination ?? "",
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {!quotations || quotations.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
            {tHistory("empty")}
            {isBuyer && tHistory("emptyBuyerHint")}
          </div>
        ) : (
          <ol className="space-y-3">
            {quotations.map((q, idx) => {
              const total = q.unit_price * q.quantity;
              const isLive = q.status === "sent";
              const expired = new Date(q.validity_until) < new Date();
              // The proposer of this quotation is `created_by` (set by both
              // submitQuotation and counterQuotation). Do NOT use
              // `countered_by` — that records who *responded* to this
              // quotation, not who created it.
              const senderRole: "buyer" | "seller" =
                q.created_by === inquiry.buyer_id ? "buyer" : "seller";
              const isMyOffer = q.created_by === user.id;
              const canActOnLive = isLive && !expired && !isAdmin && !isMyOffer;

              return (
                <li
                  key={q.id}
                  className="rounded-lg border p-4 space-y-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {tHistory("round", { n: quotations.length - idx })}
                      <span className="text-foreground">{tRolePlain(senderRole)}</span>
                      {isMyOffer && (
                        <span className="ml-1 text-foreground/70">
                          {tHistory("youSuffix")}
                        </span>
                      )}
                    </span>
                    <Badge variant="outline" className={quotationStatusColor[q.status] ?? ""}>
                      {translateQuotationStatus(q.status)}
                    </Badge>
                    {isLive && expired && (
                      <Badge variant="outline" className="text-red-400 border-red-400/40">
                        {tHistory("expiredBadge")}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(q.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">{tHistoryFields("qty")}</p>
                      <p className="font-medium">{q.quantity} {q.unit}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{tHistoryFields("unitPrice")}</p>
                      <p className="font-medium">{q.unit_price} {q.currency}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{tHistoryFields("total")}</p>
                      <p className="font-medium">{total.toFixed(2)} {q.currency}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{tHistoryFields("incoterm")}</p>
                      <p className="font-medium">{q.incoterm}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{tHistoryFields("origin")}</p>
                      <p className="font-medium">{q.origin_port ?? t("noValue")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{tHistoryFields("destination")}</p>
                      <p className="font-medium">{q.destination_port ?? t("noValue")}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">{tHistoryFields("validUntil")}</p>
                      <p className="font-medium">{new Date(q.validity_until).toLocaleString()}</p>
                    </div>
                  </div>

                  {q.notes && (
                    <>
                      <Separator />
                      <p className="text-xs whitespace-pre-wrap text-muted-foreground">{q.notes}</p>
                    </>
                  )}

                  {canActOnLive && (
                    <div className="pt-2 border-t border-border/40">
                      <QuotationActions
                        quotationId={q.id}
                        inquiryId={id}
                        defaults={{
                          quantity: q.quantity,
                          unit_price: q.unit_price,
                          currency: q.currency,
                          unit: q.unit as "MT" | "KG",
                          incoterm: q.incoterm as "FOB" | "CFR" | "CIF",
                          origin_port: q.origin_port ?? "",
                          destination_port: q.destination_port ?? "",
                        }}
                      />
                    </div>
                  )}
                  {isLive && !expired && isMyOffer && (
                    <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground">
                      {senderRole === "buyer"
                        ? tHistory("waitingForSeller")
                        : tHistory("waitingForBuyer")}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
