import { Badge } from "@/components/ui/badge";
import { DocumentUploader } from "./DocumentUploader";
import { DocumentVerifyButton } from "./DocumentVerifyButton";
import {
  DOCUMENT_GROUPS,
  DOCUMENT_LABEL,
  type DocumentType,
} from "@/lib/validations/document";

export interface OrderDocumentRow {
  id: string;
  type: DocumentType;
  file_url: string;
  file_name: string | null;
  file_size_bytes: number | null;
  uploaded_by: string;
  uploaded_at: string;
  verified_by: string | null;
  verified_at: string | null;
  admin_note: string | null;
}

interface Props {
  orderId: string;
  documents: OrderDocumentRow[];
  isAdmin: boolean;
  canUpload: boolean;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  return `${n.toFixed(1)} ${units[u]}`;
}

export function OrderDocumentsTab({
  orderId,
  documents,
  isAdmin,
  canUpload,
}: Props) {
  const byType: Record<DocumentType, OrderDocumentRow[]> = {} as Record<
    DocumentType,
    OrderDocumentRow[]
  >;
  for (const doc of documents) {
    (byType[doc.type] ??= []).push(doc);
  }

  return (
    <div className="space-y-6">
      {Object.entries(DOCUMENT_GROUPS).map(([groupName, types]) => (
        <section key={groupName} className="space-y-3">
          <h3 className="text-sm font-semibold tracking-tight">{groupName}</h3>
          <div className="space-y-3">
            {types.map((t) => {
              const docs = byType[t] ?? [];
              return (
                <div key={t} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">{DOCUMENT_LABEL[t]}</p>
                    {docs.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {docs.length} file{docs.length === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>

                  {docs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No file uploaded.</p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {docs.map((doc) => (
                        <li
                          key={doc.id}
                          className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-2 py-1.5"
                        >
                          <div className="min-w-0 flex-1">
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-primary underline block"
                            >
                              {doc.file_name ?? "file"}
                            </a>
                            <p className="text-muted-foreground text-[10px]">
                              {formatBytes(doc.file_size_bytes)} ·{" "}
                              {new Date(doc.uploaded_at).toLocaleDateString()}
                            </p>
                            {doc.admin_note && (
                              <p className="text-muted-foreground text-[10px] mt-1">
                                Admin: {doc.admin_note}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {doc.verified_at ? (
                              <Badge
                                variant="outline"
                                className="text-emerald-400 border-emerald-400/40 text-[10px]"
                              >
                                verified
                              </Badge>
                            ) : isAdmin ? (
                              <DocumentVerifyButton documentId={doc.id} />
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-yellow-400 border-yellow-400/40 text-[10px]"
                              >
                                pending verify
                              </Badge>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {canUpload && (
                    <DocumentUploader orderId={orderId} type={t} compact />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
