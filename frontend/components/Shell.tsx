"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity, BarChart3, Bell, ChevronLeft, ChevronRight, ClipboardList, FileCheck2, LayoutDashboard,
  Map as MapIcon, Settings, ShieldCheck, Search,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/alerts", label: "Catastrophe Intelligence", icon: MapIcon },
  { href: "/claims", label: "Claims Command Center", icon: ClipboardList },
  { href: "/analytics", label: "Exposure Analytics", icon: BarChart3 },
  { href: "/readiness", label: "Readiness Planner", icon: Activity },
  { href: "/documents", label: "Documents & Evidence", icon: FileCheck2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const now = new Date().toLocaleString("en-IN", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex min-h-screen">
      <aside className={`${collapsed ? "w-16" : "w-60"} flex shrink-0 flex-col bg-navy-900 text-slate-200 transition-all`}>
        <div className="flex items-center justify-between gap-2 px-3 py-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-indigo-300" aria-hidden />
              <span className="text-base font-semibold text-white">ClaimWise AI</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-md p-1 text-slate-300 hover:bg-navy-800 hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex flex-col gap-0.5 px-2" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition ${
                  active ? "bg-navy-700 text-white" : "text-slate-300 hover:bg-navy-800 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="search"
              placeholder="Search claim ID, policy ID, or region"
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:bg-white"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value.trim()) {
                  window.location.href = `/claims?q=${encodeURIComponent(e.currentTarget.value.trim())}`;
                }
              }}
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 lg:inline">{now}</span>
            <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900" title="Data source for this session">
              DEMO DATA
            </span>
            <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications" title="No live notifications in demo mode">
              <Bell className="h-4 w-4" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white" title="Adjuster profile (demo)">
              AD
            </div>
          </div>
        </header>
        <main className="flex-1 p-5">{children}</main>
      </div>
    </div>
  );
}
