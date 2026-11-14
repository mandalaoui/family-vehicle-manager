"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Ellipsis, type LucideIcon } from "lucide-react";

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
}

// "⋯" menu: keyboard accessible (arrows, Home/End), closes on Escape or outside click.
export function Menu({ items, label = "פעולות נוספות" }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    wrapRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  const onMenuKey = (e: React.KeyboardEvent) => {
    const els = [...(wrapRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      els[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      els[els.length - 1]?.focus();
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((x) => !x)}
        className="grid h-11 w-11 place-items-center rounded-xl border border-silver-300 bg-white text-ink hover:bg-silver-100"
      >
        <Ellipsis size={20} aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          onKeyDown={onMenuKey}
          className="absolute end-0 top-12 z-30 min-w-[220px] rounded-xl border border-silver-300 bg-white p-1 shadow-lg"
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={`flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-start text-sm font-medium hover:bg-silver-100 ${it.danger ? "text-red-700" : "text-ink"}`}
            >
              <it.icon size={18} className="shrink-0" aria-hidden />
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
