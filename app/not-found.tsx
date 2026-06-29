import { FileQuestion } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PrimaryButton } from "@/components/PrimaryButton";

export default function NotFound() {
  return (
    <AppShell title="AmtBrief AI">
      <section className="app-card p-5">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-civic-100 text-civic-700">
          <FileQuestion className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-ink">Screen not found</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This MiniApp screen is not available. Return home to continue with your
          latest letter or start a new scan.
        </p>
        <div className="mt-5">
          <PrimaryButton href="/">Back home</PrimaryButton>
        </div>
      </section>
    </AppShell>
  );
}
