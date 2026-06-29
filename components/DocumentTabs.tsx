"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAmtBrief } from "@/components/AmtBriefProvider";
import { DocumentSection, getScanSectionHref } from "@/lib/routes";

const documentTabs = [
  { legacyHref: "/analysis", label: "Overview", section: "overview" },
  { legacyHref: "/checklist", label: "Checklist", section: "checklist" },
  { legacyHref: "/reply", label: "Reply", section: "reply" },
] satisfies {
  legacyHref: string;
  label: string;
  section: DocumentSection;
}[];

export function DocumentTabs({ scanId }: { scanId?: string }) {
  const pathname = usePathname();
  const { activeScanId } = useAmtBrief();
  const resolvedScanId = scanId ?? activeScanId;

  return (
    <nav
      aria-label="Document sections"
      className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1"
    >
      {documentTabs.map((tab) => {
        const href = resolvedScanId
          ? getScanSectionHref(resolvedScanId, tab.section)
          : tab.legacyHref;
        const active =
          pathname === href ||
          pathname.startsWith(`${href}/`) ||
          (!resolvedScanId && pathname.startsWith(tab.legacyHref));

        return (
          <Link
            key={tab.section}
            href={href}
            className={`touch-target inline-flex items-center justify-center rounded-xl px-2 text-[13px] font-semibold transition ${
              active
                ? "bg-white text-civic-700 shadow-sm"
                : "text-slate-500 active:bg-white/70"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
