export const metadata = { title: "Verify email" };

export default function VerifyPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Check your inbox</h1>
      <p className="text-sm text-muted-foreground">
        We&apos;ve sent a verification link to your email. Once verified, your
        account status will switch to active.
      </p>
    </div>
  );
}
