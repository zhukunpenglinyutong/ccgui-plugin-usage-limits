/** Small shared hooks: stores, clock, Esc stack, outside clicks, visibility. */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import type { Store } from "../data/store.ts";

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Re-render on an interval so relative times ("2 分钟前") stay fresh. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/* Esc closes only the top-most open layer (range picker > drawer > popover). */
type EscEntry = { run: () => void };
const escStack: EscEntry[] = [];
function onEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !escStack.length) return;
  event.stopPropagation();
  escStack[escStack.length - 1].run();
}

export function useEscape(active: boolean, handler: () => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return undefined;
    const entry: EscEntry = { run: () => ref.current() };
    escStack.push(entry);
    if (escStack.length === 1) document.addEventListener("keydown", onEscape, true);
    return () => {
      const i = escStack.indexOf(entry);
      if (i >= 0) escStack.splice(i, 1);
      if (!escStack.length) document.removeEventListener("keydown", onEscape, true);
    };
  }, [active]);
}

/** Pointer-down outside every given element closes the layer. */
export function useDismiss(refs: RefObject<HTMLElement | null>[], active: boolean, onDismiss: () => void): void {
  const handler = useRef(onDismiss);
  handler.current = onDismiss;
  useEffect(() => {
    if (!active) return undefined;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && refs.some((r) => r.current?.contains(target))) return;
      handler.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
    // refs are stable objects created by useRef; only `active` re-arms the listener
  }, [active]);
}

function isShown(el: HTMLElement | null): boolean {
  if (!el || !el.isConnected || document.visibilityState === "hidden") return false;
  const check = (el as HTMLElement & { checkVisibility?: (o?: object) => boolean }).checkVisibility;
  if (typeof check === "function") return check.call(el, { visibilityProperty: true });
  return getComputedStyle(el).visibility !== "hidden" && el.getClientRects().length > 0;
}

/**
 * Whether the element is actually on screen. Host center tabs stay mounted
 * (visibility: hidden) when inactive, so this polls cheaply and also reacts
 * to the window being hidden.
 */
export function useElementVisible(ref: RefObject<HTMLElement | null>, pollMs = 1500): boolean {
  const [visible, setVisible] = useState(false);
  const update = useCallback(() => setVisible(isShown(ref.current)), [ref]);
  useEffect(() => {
    update();
    const id = setInterval(update, pollMs);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", update);
    };
  }, [update, pollMs]);
  return visible;
}
