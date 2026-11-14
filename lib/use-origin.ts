"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** The page origin in the browser ("" during server rendering). */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
}
