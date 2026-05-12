"use client";

import * as React from "react";

import {
  DASHBOARD_STYLES,
  DEFAULT_DASHBOARD_STYLE,
  type DashboardStyleId,
} from "./types";

const STORAGE_KEY = "mada.dashboard.style";
const STORAGE_EVENT = "mada-dashboard-style-changed";

function isValidStyle(value: unknown): value is DashboardStyleId {
  return (
    typeof value === "string" &&
    DASHBOARD_STYLES.some((style) => style.id === value)
  );
}

function readStored(): DashboardStyleId | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isValidStyle(stored) ? stored : null;
  } catch {
    return null;
  }
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(STORAGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(STORAGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useDashboardStyle() {
  // `useSyncExternalStore` returns the server snapshot (default) during SSR
  // and on the first client render, then swaps to the real localStorage value
  // after hydration. This avoids the "setState in effect" anti-pattern while
  // still preventing hydration mismatch.
  const style = React.useSyncExternalStore<DashboardStyleId>(
    subscribe,
    () => readStored() ?? DEFAULT_DASHBOARD_STYLE,
    () => DEFAULT_DASHBOARD_STYLE
  );

  const mounted = React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const setStyle = React.useCallback((next: DashboardStyleId) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new Event(STORAGE_EVENT));
    } catch {
      // localStorage unavailable; in-memory consumers won't sync without it.
    }
  }, []);

  return { style, setStyle, mounted };
}
