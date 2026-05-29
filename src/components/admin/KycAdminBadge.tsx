import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { parseKycDocs, summarizeKycDocs } from "@/lib/kyc/types";
import type { Json } from "@/types/database";

interface Props {
  kycLevel: number;
  kycDocs: Json;
  phoneVerifiedAt: string | null;
}

export async function KycAdminBadge({ kycLevel, kycDocs, phoneVerifiedAt }: Props) {
  const t = await getTranslations("admin");
  const tEnums = await getTranslations("enums");
  const summary = summarizeKycDocs(parseKycDocs(kycDocs));
  const label =
    kycLevel >= 0 && kycLevel <= 3
      ? tEnums(`kyc.level.${kycLevel as 0 | 1 | 2 | 3}`)
      : tEnums("kyc.levelLabel", { level: kycLevel });

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">L{kycLevel}</div>
      <p className="text-xs text-muted-foreground max-w-[140px] leading-snug">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {phoneVerifiedAt ? (
          <Badge variant="outline" className="text-[10px] text-green-400 border-green-400/40">
            {t("users.kyc.phoneBadge")}
          </Badge>
        ) : null}
        {summary.pending > 0 ? (
          <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/40">
            {t("users.kyc.docsPending", { count: summary.pending })}
          </Badge>
        ) : null}
        {summary.total > 0 && summary.pending === 0 ? (
          <Badge variant="outline" className="text-[10px]">
            {t("users.kyc.docsApprovedCount", {
              approved: summary.approved,
              total: summary.total,
            })}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
