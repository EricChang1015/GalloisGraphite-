import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { createServerClient } from "@/lib/supabase/server";
import { CollapsibleHistorySection } from "@/components/layout/CollapsibleHistorySection";
import { InquiryActions } from "@/components/listing/InquiryActions";
import { isInquiryHistoryStatus } from "@/lib/inquiry/buckets";
import {
  classifyInquiryTurn,
  getLiveQuotationsByInquiry,
  type InquiryTurn,
} from "@/lib/inquiry/actor";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export async function generateMetadata() {
  const t = await getTranslations("inquiries");
  return { title: t("metaTitle") };
}
export const dynamic = "force-dynamic";

type Translator = Awaited<ReturnType<typeof getTranslations<string>>>;

const statusColor: Record<string, string> = {
  pending: "text-yellow-400 border-yellow-400/40",
  quoted: "text-blue-400 border-blue-400/40",
  negotiating: "text-purple-400 border-purple-400/40",
  accepted: "text-cyan-400 border-cyan-400/40",
  rejected: "text-red-400 border-red-400/40",
  expired: "text-muted-foreground border-border",
  converted: "text-green-400 border-green-400/40",
};

type BuyerInquiryRow = {
  id: string;
  status: string;
  buyer_id: string;
  seller_id: string;
  requested_qty: number;
  target_price: number | null;
  destination: string | null;
  message: string | null;
  created_at: string;
  product_categories: { name: string } | null;
  profiles: { company_name: string } | null;
};

type SellerInquiryRow = BuyerInquiryRow & {
  profiles: { company_name: string; country: string } | null;
};

type RowWithTurn<T> = T & { turn: InquiryTurn; liveUnitPrice: number | null; liveCurrency: string | null };

function parseHistoryOpen(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "open";
}

function splitInquiries<T extends { status: string }>(rows: T[]) {
  const active = rows.filter((row) => !isInquiryHistoryStatus(row.status));
  const history = rows.filter((row) => isInquiryHistoryStatus(row.status));
  return { active, history };
}

function BuyerInquiriesTable({
  rows,
  t,
  tCols,
  tRow,
  tEnums,
}: {
  rows: RowWithTurn<BuyerInquiryRow>[];
  t: Translator;
  tCols: Translator;
  tRow: Translator;
  tEnums: Translator;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tCols("product")}</TableHead>
            <TableHead>{tCols("seller")}</TableHead>
            <TableHead className="text-right">{tCols("qty")}</TableHead>
            <TableHead className="text-right">{tCols("livePrice")}</TableHead>
            <TableHead>{tCols("destination")}</TableHead>
            <TableHead>{tCols("status")}</TableHead>
            <TableHead>{tCols("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((inq) => (
            <TableRow key={inq.id} className="hover:bg-muted/30">
              <TableCell className="font-medium">
                <Link href={`/inquiries/${inq.id}`} className="hover:underline">
                  {inq.product_categories?.name ?? tRow("noValue")}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {inq.profiles?.company_name ?? tRow("noValue")}
              </TableCell>
              <TableCell className="text-right">{inq.requested_qty}</TableCell>
              <TableCell className="text-right">
                {inq.liveUnitPrice != null
                  ? `${inq.liveUnitPrice} ${inq.liveCurrency ?? ""}`.trim()
                  : inq.target_price != null
                    ? tRow("targetSuffix", { value: inq.target_price })
                    : tRow("noValue")}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {inq.destination ?? tRow("noValue")}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={statusColor[inq.status] ?? ""}>
                  {translateInquiryStatus(inq.status, tEnums)}
                </Badge>
              </TableCell>
              <TableCell>
                <BuyerRowActions inquiryId={inq.id} turn={inq.turn} t={t} tRow={tRow} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function translateInquiryStatus(status: string, tEnums: Translator): string {
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

function BuyerRowActions({
  inquiryId,
  turn,
  t,
  tRow,
}: {
  inquiryId: string;
  turn: InquiryTurn;
  t: Translator;
  tRow: Translator;
}) {
  if (turn === "my-review") {
    return (
      <Link
        href={`/inquiries/${inquiryId}`}
        className="text-xs text-primary underline"
      >
        {tRow("review")}
      </Link>
    );
  }
  if (turn === "their-review" || turn === "seller-quote") {
    return (
      <span className="text-xs text-muted-foreground">{tRow("awaitingSeller")}</span>
    );
  }
  return <span className="text-xs text-muted-foreground">{tRow("noValue")}</span>;
  // `t` parameter retained for future row-level copy (e.g. tooltips).
  void t;
}

function SellerInquiriesTable({
  rows,
  t,
  tCols,
  tRow,
  tEnums,
}: {
  rows: RowWithTurn<SellerInquiryRow>[];
  t: Translator;
  tCols: Translator;
  tRow: Translator;
  tEnums: Translator;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tCols("product")}</TableHead>
            <TableHead>{tCols("buyer")}</TableHead>
            <TableHead className="text-right">{tCols("qty")}</TableHead>
            <TableHead className="text-right">{tCols("livePrice")}</TableHead>
            <TableHead>{tCols("destination")}</TableHead>
            <TableHead>{tCols("status")}</TableHead>
            <TableHead>{tCols("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((inq) => (
            <TableRow key={inq.id} className="hover:bg-muted/30">
              <TableCell className="font-medium">
                <Link href={`/inquiries/${inq.id}`} className="hover:underline">
                  {inq.product_categories?.name ?? tRow("noValue")}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {inq.profiles?.company_name ?? tRow("noValue")}
              </TableCell>
              <TableCell className="text-right">{inq.requested_qty}</TableCell>
              <TableCell className="text-right">
                {inq.liveUnitPrice != null
                  ? `${inq.liveUnitPrice} ${inq.liveCurrency ?? ""}`.trim()
                  : inq.target_price != null
                    ? tRow("targetSuffix", { value: inq.target_price })
                    : tRow("noValue")}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {inq.destination ?? tRow("noValue")}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={statusColor[inq.status] ?? ""}>
                  {translateInquiryStatus(inq.status, tEnums)}
                </Badge>
              </TableCell>
              <TableCell>
                <SellerRowActions inquiryId={inq.id} turn={inq.turn} t={t} tRow={tRow} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SellerRowActions({
  inquiryId,
  turn,
  t,
  tRow,
}: {
  inquiryId: string;
  turn: InquiryTurn;
  t: Translator;
  tRow: Translator;
}) {
  if (turn === "seller-quote") {
    return <InquiryActions inquiryId={inquiryId} />;
  }
  if (turn === "my-review") {
    return (
      <Link
        href={`/inquiries/${inquiryId}`}
        className="text-xs text-primary underline"
      >
        {tRow("review")}
      </Link>
    );
  }
  if (turn === "their-review") {
    return (
      <span className="text-xs text-muted-foreground">{tRow("awaitingBuyer")}</span>
    );
  }
  return <span className="text-xs text-muted-foreground">{tRow("noValue")}</span>;
  void t;
}

function InquiryListSection<T extends { status: string }>({
  emptyLabel,
  historyOpen,
  active,
  history,
  renderTable,
  historyTitle,
  activeEmptyLabel,
}: {
  emptyLabel: string;
  historyOpen: boolean;
  active: T[];
  history: T[];
  renderTable: (rows: T[]) => React.ReactNode;
  historyTitle: string;
  activeEmptyLabel: string;
}) {
  if (active.length === 0 && history.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <>
      {active.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {activeEmptyLabel}
        </div>
      ) : (
        renderTable(active)
      )}

      <Suspense fallback={null}>
        <CollapsibleHistorySection
          title={historyTitle}
          count={history.length}
          defaultOpen={historyOpen}
        >
          {renderTable(history)}
        </CollapsibleHistorySection>
      </Suspense>
    </>
  );
}

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ history?: string }>;
}) {
  const { history: historyParam } = await searchParams;
  const historyOpen = parseHistoryOpen(historyParam);

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const t = await getTranslations("inquiries");
  const tCols = await getTranslations("inquiries.columns");
  const tRow = await getTranslations("inquiries.row");
  const tList = await getTranslations("inquiries.list");
  const tTabs = await getTranslations("inquiries.tabs");
  const tEnums = await getTranslations("enums");

  if (!user) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        {t("sessionExpired")}
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  const isSeller =
    profile?.role === "seller" ||
    profile?.role === "admin" ||
    profile?.role === "super_admin";

  const [{ data: asBuyer }, { data: asSeller }] = await Promise.all([
    supabase
      .from("inquiries")
      .select(
        "id, status, buyer_id, seller_id, requested_qty, target_price, destination, message, created_at, product_categories(name), profiles!inquiries_seller_id_fkey(company_name)"
      )
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false })
      .returns<BuyerInquiryRow[]>(),
    isSeller
      ? supabase
          .from("inquiries")
          .select(
            "id, status, buyer_id, seller_id, requested_qty, target_price, destination, message, created_at, product_categories(name), profiles!inquiries_buyer_id_fkey(company_name, country)"
          )
          .eq("seller_id", user.id)
          .order("created_at", { ascending: false })
          .returns<SellerInquiryRow[]>()
      : { data: [] as SellerInquiryRow[] },
  ]);

  const buyerRows = asBuyer ?? [];
  const sellerRows = asSeller ?? [];

  // Per-inquiry live quotation snapshot. Drives the "whose turn" badge in
  // the Actions column and prevents the legacy Accept/Reject buttons from
  // surfacing while a counter-offer is in flight.
  const allInquiryIds = [
    ...buyerRows.map((r) => r.id),
    ...sellerRows.map((r) => r.id),
  ];
  const liveQuotations = await getLiveQuotationsByInquiry(supabase, allInquiryIds);
  // Bind to a local so the TS closure doesn't lose the early-return narrowing.
  const userId = user.id;

  function decorate<T extends BuyerInquiryRow>(rows: T[]): RowWithTurn<T>[] {
    return rows.map((r) => {
      const live = liveQuotations.get(r.id);
      return {
        ...r,
        turn: classifyInquiryTurn(r, live, userId),
        liveUnitPrice: live?.unit_price ?? null,
        liveCurrency: live?.currency ?? null,
      };
    });
  }

  const buyerSplit = splitInquiries(decorate(buyerRows));
  const sellerSplit = splitInquiries(decorate(sellerRows));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subheading")}</p>
      </div>

      <Tabs defaultValue="sent">
        <TabsList>
          <TabsTrigger value="sent">
            {tTabs("sent", { count: buyerSplit.active.length })}
          </TabsTrigger>
          {isSeller && (
            <TabsTrigger value="received">
              {tTabs("received", { count: sellerSplit.active.length })}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="sent" className="mt-4">
          <InquiryListSection
            emptyLabel={tList("emptySent")}
            activeEmptyLabel={tList("activeEmpty")}
            historyTitle={tList("historyTitle")}
            historyOpen={historyOpen}
            active={buyerSplit.active}
            history={buyerSplit.history}
            renderTable={(rows) => (
              <BuyerInquiriesTable
                rows={rows}
                t={t}
                tCols={tCols}
                tRow={tRow}
                tEnums={tEnums}
              />
            )}
          />
        </TabsContent>

        {isSeller && (
          <TabsContent value="received" className="mt-4">
            <InquiryListSection
              emptyLabel={tList("emptyReceived")}
              activeEmptyLabel={tList("activeEmpty")}
              historyTitle={tList("historyTitle")}
              historyOpen={historyOpen}
              active={sellerSplit.active}
              history={sellerSplit.history}
              renderTable={(rows) => (
                <SellerInquiriesTable
                  rows={rows}
                  t={t}
                  tCols={tCols}
                  tRow={tRow}
                  tEnums={tEnums}
                />
              )}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
