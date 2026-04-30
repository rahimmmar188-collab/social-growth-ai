"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ExportButtonProps {
  /** ID of the DOM element to capture */
  targetId?: string;
  /** Text-based sections to export (alternative to targetId) */
  sections?: { heading: string; body: string }[];
  /** PDF filename (without extension) */
  filename?: string;
  /** Report title for text-based exports */
  title?: string;
  className?: string;
  label?: string;
  variant?: "icon" | "pill";
}

export default function ExportButton({
  targetId,
  sections,
  filename = "social-growth-ai-report",
  title = "Social Growth AI Report",
  className,
  label = "Export PDF",
  variant = "pill",
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      if (sections) {
        const { exportTextToPdf } = await import("@/lib/export-pdf");
        await exportTextToPdf(title, sections, `${filename}.pdf`);
      } else if (targetId) {
        const { exportToPdf } = await import("@/lib/export-pdf");
        await exportToPdf(targetId, `${filename}.pdf`);
      }
      toast.success("PDF exported!", { description: `${filename}.pdf downloaded` });
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setExporting(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleExport}
        disabled={exporting}
        title={label}
        className={cn(
          "p-1.5 rounded-md hover:bg-white/[0.06] transition-all duration-200 text-muted-foreground hover:text-foreground disabled:opacity-40",
          className
        )}
      >
        {exporting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed",
        className
      )}
    >
      {exporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      {exporting ? "Exporting…" : label}
    </button>
  );
}
