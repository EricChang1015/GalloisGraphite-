import type { KycGateAction } from "@/lib/kyc/gate";

export function describeKycGateFailure(
  requiredLevel: number,
  currentLevel: number,
  action: KycGateAction
): string {
  const actionLabel =
    action === "submit_inquiry" ? "submit inquiries" : "create listings";
  return `KYC level ${requiredLevel} is required to ${actionLabel}. Your current level is ${currentLevel}. Upload documents on the KYC page or contact support if you were already verified.`;
}
