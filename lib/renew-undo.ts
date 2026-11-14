"use client";

import { useMemo, useSyncExternalStore } from "react";
import { daysBetween } from "./format";

// The schema keeps no "previous date" column, so the undo for "renewed" is remembered in this
// browser (30 days). The server only restores it while the date still equals the renewed one.
export type RenewField = "test_due" | "license_due";
export interface RenewUndo {
  previous: string | null;
  next: string;
  at: string; // ISO date of the renewal
}

const EVENT = "fvm-renew-undo";
export const RENEW_UNDO_DAYS = 30;
const key = (vehicleId: string, field: RenewField) => `fvm:renew:${vehicleId}:${field}`;

function read(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}

export function saveRenewUndo(vehicleId: string, field: RenewField, value: RenewUndo) {
  try {
    window.localStorage.setItem(key(vehicleId, field), JSON.stringify(value));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // storage unavailable: undo is simply not remembered
  }
}

export function clearRenewUndo(vehicleId: string, field: RenewField) {
  try {
    window.localStorage.removeItem(key(vehicleId, field));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // ignore
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** Returns the remembered undo if it is recent and the current date is still the renewed one. */
export function useRenewUndo(vehicleId: string, field: RenewField, current: string | null, today: string): RenewUndo | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key(vehicleId, field)),
    () => null,
  );
  return useMemo(() => {
    if (!raw) return null;
    try {
      const v = JSON.parse(raw) as RenewUndo;
      if (typeof v.next !== "string" || typeof v.at !== "string") return null;
      if (v.next !== current) return null;
      if (daysBetween(v.at, today) > RENEW_UNDO_DAYS) return null;
      return v;
    } catch {
      return null;
    }
  }, [raw, current, today]);
}
