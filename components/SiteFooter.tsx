import Link from "next/link";

const linkClass = "inline-flex min-h-11 items-center px-2 underline";

export function SiteFooter() {
  return (
    <footer className="border-t border-silver-300 bg-white/60 px-4 py-2 text-center text-xs text-muted">
      <nav aria-label="קישורים משפטיים" className="flex flex-wrap items-center justify-center gap-x-2">
        <Link href="/privacy" className={linkClass}>
          מדיניות פרטיות
        </Link>
        <Link href="/terms" className={linkClass}>
          תנאי שימוש
        </Link>
        <span className="inline-flex min-h-11 items-center px-2">© 2026 ניהול רכבי המשפחה</span>
      </nav>
    </footer>
  );
}
