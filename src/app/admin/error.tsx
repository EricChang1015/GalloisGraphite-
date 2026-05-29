"use client";

import { useTranslations } from "next-intl";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("admin");

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <h2 className="text-xl font-semibold">{t("error.title")}</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        {error.message ?? t("error.fallback")}
      </p>
      <button
        onClick={reset}
        className="text-sm text-primary underline hover:no-underline"
      >
        {t("error.tryAgain")}
      </button>
    </div>
  );
}
