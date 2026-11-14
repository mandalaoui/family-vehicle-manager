"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CircleCheck, Info, TriangleAlert } from "lucide-react";

type ToastType = "success" | "info" | "error";
interface ToastAction {
  label: string;
  onClick: () => void;
}
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
}
export interface ToastOptions {
  type?: ToastType;
  action?: ToastAction;
  /** ms; undo toasts use ~9000. */
  duration?: number;
}
type ToastFn = (message: string, options?: ToastOptions) => void;

const ToastContext = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback<ToastFn>(
    (message, options = {}) => {
      const id = ++counter.current;
      setToasts((t) => [...t.slice(-2), { id, message, type: options.type ?? "success", action: options.action }]);
      setTimeout(() => dismiss(id), options.duration ?? (options.action ? 9000 : 4200));
    },
    [dismiss],
  );

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => {
          const Icon = t.type === "error" ? TriangleAlert : t.type === "info" ? Info : CircleCheck;
          return (
            <div
              key={t.id}
              role="status"
              className={`toast-in pointer-events-auto flex max-w-md items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
                t.type === "error" ? "bg-red-700" : t.type === "info" ? "bg-gray-800" : "bg-green-800"
              }`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
              <span className="flex-1">{t.message}</span>
              {t.action ? (
                <button
                  type="button"
                  onClick={() => {
                    dismiss(t.id);
                    t.action?.onClick();
                  }}
                  className="-my-1 min-h-[36px] shrink-0 rounded-lg border border-white/60 px-3 font-bold underline hover:bg-white/10"
                >
                  {t.action.label}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
