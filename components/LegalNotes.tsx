import { ShieldCheck } from "lucide-react";

export function LegalNotes() {
  return (
    <div className="app-card-subtle p-4 text-xs leading-5 text-slate-600">
      <div className="mb-2 flex items-center gap-2 font-semibold text-slate-800">
        <ShieldCheck className="h-4 w-4 text-civic-600" />
        Privacy & disclaimer
      </div>
      <p>
        Your analyzed document and generated next steps are saved in your scan
        history. Upload only the pages needed for this request.
      </p>
      <p className="mt-2">
        AmtBrief AI helps you understand and prepare documents. It is not legal
        advice.
      </p>
    </div>
  );
}
