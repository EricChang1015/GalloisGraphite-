"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";

import { resendVerification } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function VerifyResendForm() {
  const searchParams = useSearchParams();
  const initialEmail = useMemo(() => searchParams.get("email") ?? "", [searchParams]);
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onResend() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await resendVerification({ email });
      if (result.error) {
        setError(result.error.message);
        return;
      }

      setMessage("Verification email resent. Please check your inbox and spam folder.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check your inbox</CardTitle>
        <CardDescription>We sent a verification link to activate your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Once verified, you can sign in and continue to your dashboard.
        </p>

        <div className="space-y-2">
          <Input
            type="email"
            value={email}
            placeholder="you@company.com"
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isPending || email.length === 0}
            onClick={onResend}
          >
            {isPending ? "Resending..." : "Resend verification email"}
          </Button>
        </div>

        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <p className="text-sm text-muted-foreground">
          Already verified?{" "}
          <Link href="/login" className="text-foreground underline underline-offset-4">
            Go to login
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
