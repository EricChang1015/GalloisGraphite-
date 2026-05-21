export type ChatMessageContextType = "listing" | "inquiry" | "order";

export type ChatMessageRow = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string | null;
  attachment_url: string | null;
  context_type: ChatMessageContextType | null;
  context_id: string | null;
  created_at: string;
  sender?: {
    full_name: string | null;
    company_name: string | null;
    avatar_url?: string | null;
  } | null;
};

export type ConversationSummary = {
  roomId: string;
  counterpartyId: string;
  counterpartyLabel: string;
  counterpartyCountry: string | null;
  counterpartyAvatarUrl: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
};

export type ChatContext = {
  type: ChatMessageContextType;
  id: string;
  label?: string;
};
