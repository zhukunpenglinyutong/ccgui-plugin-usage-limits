/**
 * Rich tooltip for charts only (trend bars, heatmap cells, share bar); every
 * other hint uses the native `title` the host renders as its own bubble.
 * Shown on hover and on keyboard focus, positioned `fixed` above the target.
 */
import { useLayoutEffect, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from "react";
import { createStore } from "../data/store.ts";
import { useStore } from "./hooks.ts";

interface TipState {
  content: ReactNode | null;
  rect: { left: number; top: number; bottom: number; width: number } | null;
}

const tipStore = createStore<TipState>({ content: null, rect: null });

export function showTip(el: Element, content: ReactNode): void {
  const r = el.getBoundingClientRect();
  tipStore.set(() => ({ content, rect: { left: r.left, top: r.top, bottom: r.bottom, width: r.width } }));
}

export function hideTip(): void {
  tipStore.set((s) => (s.content ? { content: null, rect: null } : s));
}

/** Spread onto a chart element: hover / focus show the tip, leave / blur hide it. */
export function tipHandlers(content: () => ReactNode) {
  return {
    onMouseEnter: (e: MouseEvent<Element>) => showTip(e.currentTarget, content()),
    onMouseLeave: hideTip,
    onFocus: (e: FocusEvent<Element>) => showTip(e.currentTarget, content()),
    onBlur: hideTip,
  };
}

export function ChartTip() {
  const { content, rect } = useStore(tipStore);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!rect || !ref.current) {
      setPos(null);
      return;
    }
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), window.innerWidth - w - 8);
    const top = rect.top - h - 8 < 8 ? rect.bottom + 8 : rect.top - h - 8;
    setPos({ left, top });
  }, [rect, content]);
  useLayoutEffect(() => hideTip, []);
  if (!content) return null;
  return (
    <div ref={ref} className="ul-tip" role="tooltip" style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden", left: 0, top: 0 }}>
      {content}
    </div>
  );
}
