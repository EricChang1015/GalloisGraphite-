export type ChatMessageRow = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string | null;
  attachment_url: string | null;
  created_at: string;
  sender?: {
    full_name: string | null;
    company_name: string | null;
  } | null;
};

export type ChatRoomSummary = {
  roomId: string;
  orderId: string;
  orderNo: string;
  orderStatus: string;
  counterpartyLabel: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
};
