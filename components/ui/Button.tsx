import Link from "next/link";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "neutral" | "danger" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark border border-transparent",
  secondary: "bg-white text-brand border border-brand hover:bg-brand-50",
  neutral: "bg-white text-ink border border-silver-300 hover:bg-silver-100",
  danger: "bg-red-700 text-white hover:bg-red-800 border border-transparent",
  ghost: "text-brand hover:bg-brand-50 border border-transparent",
};

export function buttonClass(variant: ButtonVariant = "primary", className = "") {
  return `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`;
}

interface CommonProps {
  variant?: ButtonVariant;
  icon?: LucideIcon;
}

export function Button({
  variant = "primary",
  icon: Icon,
  loading,
  className = "",
  children,
  type = "button",
  disabled,
  ...rest
}: CommonProps & { loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, className)} {...rest}>
      {loading ? <LoaderCircle size={18} className="shrink-0 animate-spin" aria-hidden /> : Icon ? <Icon size={18} className="shrink-0" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  icon: Icon,
  className = "",
  children,
  ...rest
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClass(variant, className)} {...rest}>
      {Icon ? <Icon size={18} className="shrink-0" aria-hidden /> : null}
      {children}
    </Link>
  );
}
