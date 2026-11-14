"use client";

import { TriangleAlert } from "lucide-react";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { digitsOnly, maskDate } from "@/lib/format";

export const inputClass = (error?: string) =>
  `min-h-[44px] w-full rounded-xl border bg-white px-3 text-base text-ink placeholder:text-gray-500 ${error ? "border-red-600" : "border-silver-300"}`;

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p id={`${id}-err`} role="alert" className="flex items-start gap-1 text-xs font-semibold text-red-700">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}

const aria = (id: string, error?: string) => ({
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error ? `${id}-err` : undefined,
});

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & { id: string; error?: string; ltr?: boolean };

export function TextInput({ id, error, ltr, className = "", ...rest }: InputProps) {
  return (
    <input
      id={id}
      {...aria(id, error)}
      {...(ltr ? { dir: "ltr" as const } : {})}
      className={`${inputClass(error)} ${ltr ? "text-end" : ""} ${className}`}
      {...rest}
    />
  );
}

export function DateInput({
  id,
  value,
  onChange,
  error,
  ...rest
}: Omit<InputProps, "onChange" | "value" | "ltr"> & { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      id={id}
      ltr
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/yyyy"
      maxLength={10}
      value={value}
      error={error}
      onChange={(e) => onChange(maskDate(e.target.value))}
      {...rest}
    />
  );
}

export function NumberInput({
  id,
  value,
  onChange,
  error,
  max = 7,
  ...rest
}: Omit<InputProps, "onChange" | "value" | "ltr"> & { value: string; onChange: (v: string) => void; max?: number }) {
  return (
    <TextInput
      id={id}
      ltr
      inputMode="numeric"
      autoComplete="off"
      value={value}
      error={error}
      onChange={(e) => onChange(digitsOnly(e.target.value).slice(0, max))}
      {...rest}
    />
  );
}

export function SelectInput({
  id,
  value,
  onChange,
  error,
  options,
  placeholder = "בחירה",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const opts = value && !options.some((o) => o.value === value) ? [...options, { value, label: value }] : options;
  return (
    <select id={id} {...aria(id, error)} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass(error)}>
      <option value="">{placeholder}</option>
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TextArea({
  id,
  error,
  className = "",
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & { id: string; error?: string }) {
  return <textarea id={id} {...aria(id, error)} className={`${inputClass(error)} py-2 ${className}`} {...rest} />;
}

export type { SelectHTMLAttributes };
