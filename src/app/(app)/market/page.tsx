export const metadata = { title: "Market" };

export default function MarketPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Market</h1>
      <p className="text-sm text-muted-foreground">
        Browse active listings. Filters: category / price / origin. Click any
        listing to inquire.
      </p>
    </div>
  );
}
