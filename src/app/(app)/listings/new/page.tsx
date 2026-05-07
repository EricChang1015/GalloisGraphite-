export const metadata = { title: "New listing" };

export default function NewListingPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">New listing</h1>
      <p className="text-sm text-muted-foreground">
        Create-listing form goes here. Selecting a category should
        dynamically render the spec fields from{" "}
        <code>category.spec_schema</code>.
      </p>
    </div>
  );
}
