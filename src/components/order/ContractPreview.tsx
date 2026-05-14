"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface Props {
  contractNo: string;
  revision: number;
  contentHtml: string | null;
}

export function ContractPreview({ contractNo, revision, contentHtml }: Props) {
  function handlePrint() {
    if (!contentHtml) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(contentHtml);
    win.document.close();
    win.print();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {contractNo}{" "}
          <span className="text-xs text-muted-foreground font-normal">
            · Revision {revision}
          </span>
        </p>
        {contentHtml && (
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Printer className="size-3.5 mr-1" />
            Print / Save PDF
          </Button>
        )}
      </div>
      {contentHtml && (
        <div
          className="rounded border bg-white text-black p-4 text-xs max-h-96 overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      )}
    </div>
  );
}
