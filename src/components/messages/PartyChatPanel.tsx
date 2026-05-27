"use client";

import { useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { sendChatMessage } from "@/actions/chat";
import { ChatMessageBubble } from "@/components/order/ChatMessageBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePartyMessages } from "@/hooks/usePartyMessages";
import type { ChatContext, ChatMessageRow } from "@/lib/chat/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const BUCKET = "order-documents";
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

interface Props {
  roomId: string;
  currentUserId: string;
  initialMessages: ChatMessageRow[];
  pendingContext?: ChatContext;
  canPost?: boolean;
  className?: string;
}

export function PartyChatPanel({
  roomId,
  currentUserId,
  initialMessages,
  pendingContext,
  canPost = true,
  className,
}: Props) {
  const t = useTranslations("messages.panel");
  const [draft, setDraft] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inputLocked = isSending || isUploading;

  const { messages, appendMessage } = usePartyMessages({
    roomId,
    initialMessages,
    enabled: true,
  });

  async function uploadAttachment(file: File): Promise<string | null> {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error(t("toast.attachmentTooBig"));
      return null;
    }
    const allowed =
      file.type.startsWith("image/") || file.type === "application/pdf";
    if (!allowed) {
      toast.error(t("toast.badAttachmentType"));
      return null;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `party/${roomId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        toast.error(t("toast.uploadFailed", { message: uploadError.message }));
        return null;
      }

      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 7);

      if (signErr || !signed?.signedUrl) {
        toast.error(t("toast.signFailed"));
        return null;
      }

      return signed.signedUrl;
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSend() {
    if (sendingRef.current || inputLocked) return;

    const text = draft.trim();
    if (!text && !attachmentFile) return;

    sendingRef.current = true;
    setIsSending(true);

    try {
      let attachmentUrl: string | undefined;
      if (attachmentFile) {
        const url = await uploadAttachment(attachmentFile);
        if (!url && !text) return;
        attachmentUrl = url ?? undefined;
      }

      const result = await sendChatMessage({
        roomId,
        content: text || undefined,
        attachmentUrl,
        contextType: pendingContext?.type,
        contextId: pendingContext?.id,
      });

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      appendMessage(result.data!.message);
      setDraft("");
      setAttachmentFile(null);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  }

  return (
    <div className={cn("flex flex-col rounded-lg border", className)}>
      <div className="flex-1 min-h-64 max-h-96 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t("empty")}
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
          {pendingContext?.label ? (
            <p className="text-xs text-muted-foreground">
              {t("contextHint", { label: pendingContext.label })}
            </p>
          ) : null}
          {attachmentFile ? (
            <p className="text-xs text-muted-foreground truncate">
              {t("attachmentLine", { name: attachmentFile.name })}
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => setAttachmentFile(null)}
              >
                {t("removeAttachment")}
              </button>
            </p>
          ) : null}
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isSending ? t("sendingPlaceholder") : t("placeholder")}
            rows={2}
            className="resize-none"
            disabled={inputLocked}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!inputLocked) void handleSend();
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
              aria-label={t("attachAria")}
              disabled={inputLocked}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="size-4" />
            </Button>
            <Button
              type="button"
              className="ml-auto gap-1"
              disabled={
                inputLocked || (!draft.trim() && !attachmentFile)
              }
              onClick={() => void handleSend()}
            >
              <Send className="size-4" />
              {isSending ? t("sending") : t("send")}
            </Button>
          </div>
        </div>
      ) : (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          {t("viewOnly")}
        </p>
      )}
    </div>
  );
}
