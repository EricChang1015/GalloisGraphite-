/** Inquiries that no longer need user action — shown under History Inquiries. */
export const INQUIRY_HISTORY_STATUSES = ["rejected", "converted"] as const;

export type InquiryHistoryStatus = (typeof INQUIRY_HISTORY_STATUSES)[number];

export function isInquiryHistoryStatus(status: string): boolean {
  return (INQUIRY_HISTORY_STATUSES as readonly string[]).includes(status);
}
