"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { requestPhoneOtp, verifyPhoneOtpCode } from "@/actions/kyc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  phone: string | null;
  phoneVerifiedAt: string | null;
  kycLevel: number;
}

export function PhoneVerifyPanel({ phone, phoneVerifiedAt, kycLevel }: Props) {
  const router = useRouter();
  const t = useTranslations("kyc.phone");
  const [phoneInput, setPhoneInput] = useState(phone ?? "");
  const [code, setCode] = useState("");
  const [devHint, setDevHint] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const verified = Boolean(phoneVerifiedAt) || kycLevel >= 1;

  function handleSendCode() {
    startTransition(async () => {
      const result = await requestPhoneOtp({ phone: phoneInput.trim() });
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      if (result.data?.sentViaSms) {
        toast.success(t("toast.sent"));
        setDevHint(null);
      } else if (result.data?.devCode) {
        setDevHint(result.data.devCode);
        toast.message(t("toast.devOnly"));
      } else {
        toast.success(t("toast.issued"));
      }
    });
  }

  function handleVerify() {
    startTransition(async () => {
      const result = await verifyPhoneOtpCode({ code: code.trim() });
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        t("toast.verified", { level: result.data?.kycLevel ?? 1 })
      );
      setCode("");
      setDevHint(null);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Phone className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{t("heading")}</h3>
      </div>
      {verified ? (
        <p className="text-sm text-green-400">
          {t("verified")}
          {phoneVerifiedAt
            ? ` · ${new Date(phoneVerifiedAt).toLocaleString()}`
            : ""}
          {phone ? ` · ${phone}` : ""}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{t("intro")}</p>
          <div className="space-y-2">
            <Label htmlFor="kyc-phone">{t("label")}</Label>
            <Input
              id="kyc-phone"
              type="tel"
              placeholder={t("placeholder")}
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || !phoneInput.trim()}
              onClick={handleSendCode}
            >
              {t("sendCode")}
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kyc-otp">{t("codeLabel")}</Label>
            <Input
              id="kyc-otp"
              inputMode="numeric"
              maxLength={6}
              placeholder={t("codePlaceholder")}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          {devHint ? (
            <p className="text-xs text-amber-400 font-mono">
              {t("devCode", { code: devHint })}
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={isPending || code.length !== 6}
            onClick={handleVerify}
          >
            {t("verifyButton")}
          </Button>
        </>
      )}
    </section>
  );
}
