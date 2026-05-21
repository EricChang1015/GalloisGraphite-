import { FileText } from "lucide-react";
import Link from "next/link";

import { formatContextLabel } from "@/lib/chat/context-label";
import { cn } from "@/lib/utils";
import type { ChatMessageRow } from "@/lib/chat/types";

interface Props {
  message: ChatMessageRow;
  isOwn: boolean;
}

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif|heic|heif)(\?|$)/i.test(url);
}

export function ChatMessageBubble({ message, isOwn }: Props) {
  const label =
    message.sender?.company_name?.trim() ||
    message.sender?.full_name?.trim() ||
    "User";

  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg border px-3 py-2 text-sm space-y-1",
          isOwn
            ? "border-primary/30 bg-primary/10"
            : "border-border bg-muted/30"
        )}
      >
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {isOwn ? "You" : label}
        </p>
        {message.context_type && message.context_id ? (
          <p className="text-[10px] text-primary/80">
            Re: {formatContextLabel(message.context_type)}
          </p>
        ) : null}
        {message.content ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : null}
        {message.attachment_url ? (
          isImageUrl(message.attachment_url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.attachment_url}
              alt="Attachment"
              className="max-h-48 rounded border object-contain"
            />
          ) : (
            <Link
              href={message.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary underline"
            >
              <FileText className="size-3" />
              View attachment
            </Link>
          )
        ) : null}
        <p className="text-[10px] text-muted-foreground">
          {new Date(message.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
