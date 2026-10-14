"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Banknote,
  History,
  LayoutDashboard,
  Menu,
  PlusCircle,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cash-entry", label: "Cash Entry", icon: PlusCircle },
  { href: "/salesmen", label: "Salesmen", icon: Users },
  { href: "/daily-log", label: "Daily Log", icon: History },
  { href: "/denomination", label: "Denomination", icon: Banknote },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
        <Wallet className="h-5 w-5" aria-hidden />
      </span>
      <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        Cash Flow
      </span>
    </Link>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${
                  active
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                }`}
                aria-hidden
              />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer with Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 print:hidden flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 lg:hidden print:hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-slate-900/50 transition-opacity ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          id="mobile-sidebar"
          inert={!open}
          className={`absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl transition-transform duration-200 dark:bg-slate-900 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
            <Brand />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-3" aria-label="Main">
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
          </nav>
        </aside>
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex print:hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-16 items-center border-b border-slate-200 px-5 dark:border-slate-800">
          <Brand />
        </div>
        <nav className="flex-1 overflow-y-auto p-3" aria-label="Main">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="border-t border-slate-200 p-4 text-xs text-slate-400 dark:border-slate-800">
          Cash Flow Management
        </div>
      </aside>
    </>
  );
}
