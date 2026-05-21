import type { KycGateAction } from "@/lib/kyc/gate";

export function describeKycGateFailure(
  requiredLevel: number,
  currentLevel: number,
  action: KycGateAction
): string {
  const actionLabel =
    action === "submit_inquiry" ? "submit inquiries" : "create listings";
  return `KYC level ${requiredLevel} is required to ${actionLabel}. Your current level is ${currentLevel}. Complete phone verification and/or upload documents on the KYC page, or contact support if you were already verified.`;
}
