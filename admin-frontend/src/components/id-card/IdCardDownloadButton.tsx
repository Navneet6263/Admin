import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { downloadIdCardPdf } from "./idCardPdf";
import type { IdCardDetails } from "./visionIndiaIdCard";

export function IdCardDownloadButton({ details, disabled = false }: { details: IdCardDetails; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try { await downloadIdCardPdf(details); }
    catch (error) { toast.error(error instanceof Error ? error.message : "PDF could not be generated. Please try again."); }
    finally { setBusy(false); }
  };
  return <button type="button" disabled={disabled || busy} onClick={() => void download()}
    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40">
    <Download className="h-3.5 w-3.5" /> {busy ? "Preparing PDF…" : "Download PDF preview"}
  </button>;
}
