import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

export function Section({
  icon: Icon,
  title,
  action,
  children,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-silver-300 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Icon size={20} className="shrink-0 text-brand" aria-hidden />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-silver-300 bg-silver-50 px-4 py-6 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-silver-100 text-muted">
        <Icon size={22} aria-hidden />
      </div>
      <p className="font-semibold">{title}</p>
      {children ? <p className="max-w-sm text-sm text-muted">{children}</p> : null}
    </div>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  backHref,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  backHref?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="חזרה"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-silver-300 bg-white hover:bg-silver-100"
          >
            <ArrowRight size={20} aria-hidden />
          </Link>
        ) : null}
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold">{title}</h1>
          {subtitle ? <div className="text-sm text-muted">{subtitle}</div> : null}
        </div>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Notice({
  tone = "info",
  icon: Icon,
  children,
  role,
}: {
  tone?: "info" | "warn" | "error" | "success";
  icon: LucideIcon;
  children: React.ReactNode;
  role?: "alert" | "status";
}) {
  const cls = {
    info: "border-silver-300 bg-white text-ink",
    warn: "border-amber-300 bg-amber-50 text-amber-900",
    error: "border-red-300 bg-red-50 text-red-800",
    success: "border-green-300 bg-green-50 text-green-900",
  }[tone];
  return (
    <p role={role} className={`flex items-start gap-2 rounded-xl border p-3 text-sm font-medium ${cls}`}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-end text-sm font-semibold">{children}</dd>
    </div>
  );
}
