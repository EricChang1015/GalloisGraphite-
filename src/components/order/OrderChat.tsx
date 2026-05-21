"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, Send } from "lucide-react";
import { toast } from "sonner";

import { sendChatMessage } from "@/actions/chat";
import { ChatMessageBubble } from "@/components/order/ChatMessageBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useOrderMessages } from "@/hooks/useOrderMessages";
import type { ChatMessageRow } from "@/lib/chat/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const BUCKET = "order-documents";
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

interface Props {
  roomId: string;
  orderId: string;
  currentUserId: string;
  initialMessages: ChatMessageRow[];
  canPost?: boolean;
  className?: string;
}

export function OrderChat({
  roomId,
  orderId,
  currentUserId,
  initialMessages,
  canPost = true,
  className,
}: Props) {
  const [draft, setDraft] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages, appendMessage } = useOrderMessages({
    roomId,
    initialMessages,
    enabled: true,
  });

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  async function uploadAttachment(file: File): Promise<string | null> {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("Attachment must be 5 MB or smaller.");
      return null;
    }
    const allowed =
      file.type.startsWith("image/") || file.type === "application/pdf";
    if (!allowed) {
      toast.error("Only images and PDF files are allowed.");
      return null;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${orderId}/chat/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        return null;
      }

      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 7);

      if (signErr || !signed?.signedUrl) {
        toast.error("Could not generate attachment URL.");
        return null;
      }

      return signed.signedUrl;
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text && !attachmentFile) return;

    let attachmentUrl: string | undefined;
    if (attachmentFile) {
      const url = await uploadAttachment(attachmentFile);
      if (!url && !text) return;
      attachmentUrl = url ?? undefined;
    }

    startTransition(async () => {
      const result = await sendChatMessage({
        roomId,
        content: text || undefined,
        attachmentUrl,
      });
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      appendMessage(result.data!.message);
      setDraft("");
      setAttachmentFile(null);
      scrollToBottom();
    });
  }

  return (
    <div className={cn("flex flex-col rounded-lg border", className)}>
      <div className="flex-1 min-h-64 max-h-96 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No messages yet. Coordinate shipment, payment, and documents with your
            trading partner here.
          </p>
        ) : (
          messages.map((m) => (
            <ChatMessageBubble
              key={m.id}
              message={m}
              isOwn={m.sender_id === currentUserId}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {canPost ? (
      <div className="border-t p-3 space-y-2">
        {attachmentFile ? (
          <p className="text-xs text-muted-foreground truncate">
            Attachment: {attachmentFile.name}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setAttachmentFile(null)}
            >
              Remove
            </button>
          </p>
        ) : null}
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          rows={2}
          className="resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <div className="flex items-center gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Attach file"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="size-4" />
          </Button>
          <Button
            type="button"
            className="ml-auto gap-1"
            disabled={isUploading || (!draft.trim() && !attachmentFile)}
            onClick={() => void handleSend()}
          >
            <Send className="size-4" />
            Send
          </Button>
        </div>
      </div>
      ) : (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          View-only: platform admins can read order messages but cannot post here.
        </p>
      )}
    </div>
  );
}
