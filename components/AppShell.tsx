"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, FileText, Home, Landmark } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home, matches: ["/"] },
  {
    href: "/scans",
    label: "My Scans",
    icon: FileText,
    matches: ["/scans", "/input", "/analysis", "/checklist", "/reply"],
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: CheckSquare,
    matches: ["/tasks", "/reminder"],
  },
];

export function AppShell({
  children,
  title = "AmtBrief AI",
  eyebrow = "1DE MiniApp",
}: {
  children: React.ReactNode;
  title?: string;
  eyebrow?: string;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col bg-civic-50 shadow-[0_0_44px_rgba(15,23,42,0.08)]">
      <header className="safe-top sticky top-0 z-20 border-b border-slate-200/70 bg-civic-50/95 px-5 pb-3 pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-civic-100 text-civic-700">
            <Landmark className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-civic-700">
              {eyebrow}
            </p>
            <h1 className="truncate text-base font-semibold text-ink">{title}</h1>
          </div>
        </div>
      </header>
      <section className="flex-1 px-5 pb-[104px] pt-4">{children}</section>
      <BottomNavigation />
    </main>
  );
}

function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-slate-200/80 bg-white/92 px-4 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="grid grid-cols-3 gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : item.matches.some((match) => pathname.startsWith(match));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`touch-target flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] font-medium transition ${
                active
                  ? "bg-civic-100 text-civic-700"
                  : "text-slate-500 active:bg-slate-100"
              }`}
            >
              <Icon className="mb-1 h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
