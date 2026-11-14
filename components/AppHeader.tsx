"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Car, Check, LogOut, Menu, Settings, X } from "lucide-react";

const TABS = [
  { href: "/", label: "רכבים", icon: Car, match: (p: string) => p === "/" || p.startsWith("/vehicles") },
  { href: "/settings", label: "הגדרות", icon: Settings, match: (p: string) => p.startsWith("/settings") },
];

function SignOut({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}

export function AppHeader({ familyName }: { familyName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const headerRef = useRef<HTMLElement>(null);

  // Close the mobile panel after navigating.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <header ref={headerRef} className="sticky top-0 z-20 border-b border-silver-300 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex min-h-[44px] min-w-0 items-center gap-3 rounded-xl text-start">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
            <Car size={22} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-bold leading-tight">ניהול רכבי המשפחה</span>
            <span className="block truncate text-xs text-muted">{familyName}</span>
          </span>
        </Link>

        <nav aria-label="ניווט ראשי" className="hidden items-center gap-1 md:flex">
          {TABS.map((t) => {
            const active = t.match(pathname);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-semibold ${active ? "bg-brand-50 text-brand" : "text-ink hover:bg-silver-100"}`}
              >
                <t.icon size={18} aria-hidden />
                {t.label}
              </Link>
            );
          })}
          <SignOut className="flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-semibold text-ink hover:bg-silver-100">
            <LogOut size={18} aria-hidden />
            התנתקות
          </SignOut>
        </nav>

        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-xl border border-silver-300 bg-white hover:bg-silver-100 md:hidden"
          aria-label={open ? "סגירת התפריט" : "פתיחת התפריט"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((x) => !x)}
        >
          {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
      </div>

      {open ? (
        <div id="mobile-menu" className="absolute inset-x-0 top-full border-b border-silver-300 bg-white shadow-lg md:hidden">
          <nav aria-label="ניווט ראשי" className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-3">
            {TABS.map((t) => {
              const active = t.match(pathname);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-base font-semibold ${active ? "bg-brand-50 text-brand" : "text-ink hover:bg-silver-100"}`}
                >
                  <t.icon size={22} aria-hidden />
                  {t.label}
                  {active ? <Check size={18} className="ms-auto" aria-hidden /> : null}
                </Link>
              );
            })}
            <div className="mt-2 border-t border-silver-200 pt-2">
              <SignOut className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-start text-base font-semibold text-ink hover:bg-silver-100">
                <LogOut size={22} aria-hidden />
                התנתקות
              </SignOut>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
