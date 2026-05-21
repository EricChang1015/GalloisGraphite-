import { Badge } from "@/components/ui/badge";
import {
  KYC_LEVEL_LABELS,
  parseKycDocs,
  summarizeKycDocs,
} from "@/lib/kyc/types";
import type { Json } from "@/types/database";

interface Props {
  kycLevel: number;
  kycDocs: Json;
  phoneVerifiedAt: string | null;
}

export function KycAdminBadge({ kycLevel, kycDocs, phoneVerifiedAt }: Props) {
  const summary = summarizeKycDocs(parseKycDocs(kycDocs));
  const label = KYC_LEVEL_LABELS[kycLevel] ?? `Level ${kycLevel}`;

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">L{kycLevel}</div>
      <p className="text-xs text-muted-foreground max-w-[140px] leading-snug">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {phoneVerifiedAt ? (
          <Badge variant="outline" className="text-[10px] text-green-400 border-green-400/40">
            Phone ✓
          </Badge>
        ) : null}
        {summary.pending > 0 ? (
          <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/40">
            {summary.pending} doc{summary.pending > 1 ? "s" : ""} pending
          </Badge>
        ) : null}
        {summary.total > 0 && summary.pending === 0 ? (
          <Badge variant="outline" className="text-[10px]">
            {summary.approved}/{summary.total} docs
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
